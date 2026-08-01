import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";

/** Navbar toggle for "Preview changes" mode. When on, the board merges the local draft and
 *  edit controls appear; a badge shows how many stars are staged. */
export function PreviewToggle({
  on,
  onChange,
  count,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  count: number;
}) {
  return (
    <Button
      variant={on ? "warning" : "outline-warning"}
      size="sm"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      title={on ? "Exit preview (show published only)" : "Preview & propose changes"}
    >
      ✎ Preview
      {count > 0 && (
        <Badge bg="dark" className="ms-1">
          {count}
        </Badge>
      )}
    </Button>
  );
}
