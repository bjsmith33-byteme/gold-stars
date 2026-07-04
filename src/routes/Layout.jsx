import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import Navbar from "react-bootstrap/Navbar";
import Nav from "react-bootstrap/Nav";
import Offcanvas from "react-bootstrap/Offcanvas";
import Container from "react-bootstrap/Container";
import { aggregate, parseCsv } from "../lib/aggregate.js";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { Footer } from "../components/Footer.jsx";

/** App shell: an offcanvas ("sheet") side-nav, the theme toggle, the routed page, and a
 *  constant footer. Owns the single CSV fetch and shares the parsed data with pages via
 *  Outlet context, so pages don't each re-fetch. */
export function Layout() {
  const [events, setEvents] = useState([]);
  const [agg, setAgg] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Cache-bust so a freshly published CSV shows without a hard refresh.
    fetch(`${import.meta.env.BASE_URL}gold-stars.csv?t=${Date.now()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load gold-stars.csv (${r.status})`);
        return r.text();
      })
      .then((text) => {
        const evs = parseCsv(text);
        setEvents(evs);
        setAgg(aggregate(evs));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Scroll to top on route change.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const closeNav = () => setExpanded(false);

  return (
    <>
      <Navbar
        expand={false}
        expanded={expanded}
        onToggle={setExpanded}
        bg="body-tertiary"
        className="border-bottom"
        sticky="top"
      >
        <Container>
          <Navbar.Brand as={Link} to="/" className="fw-bold">
            ⭐ Gold Stars
          </Navbar.Brand>
          <div className="d-flex align-items-center gap-2">
            <ThemeToggle />
            <Navbar.Toggle aria-controls="main-nav" />
          </div>
          <Navbar.Offcanvas id="main-nav" aria-labelledby="main-nav-title" placement="end">
            <Offcanvas.Header closeButton>
              <Offcanvas.Title id="main-nav-title">Menu</Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body>
              <Nav className="flex-column">
                <Nav.Link as={NavLink} to="/" end onClick={closeNav}>
                  Home
                </Nav.Link>
                <Nav.Link as={NavLink} to="/kb" onClick={closeNav}>
                  Knowledge Base
                </Nav.Link>
                <Nav.Link as={NavLink} to="/about" onClick={closeNav}>
                  About
                </Nav.Link>
                <hr />
                <div className="text-uppercase small fw-semibold text-body-secondary px-2 mb-1">
                  Teams
                </div>
                <Nav.Link as={NavLink} to="/" end onClick={closeNav}>
                  Dev Team
                </Nav.Link>
                {/* Add more team routes here as they're created, e.g.:
                    <Nav.Link as={NavLink} to="/design-team" onClick={closeNav}>Design Team</Nav.Link> */}
              </Nav>
            </Offcanvas.Body>
          </Navbar.Offcanvas>
        </Container>
      </Navbar>

      <Container className="py-4" style={{ maxWidth: "56rem" }}>
        <Outlet context={{ events, agg, error }} />
      </Container>

      <Footer />
    </>
  );
}
