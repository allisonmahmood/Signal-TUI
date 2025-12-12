import { render } from "ink";
import App from "./App.tsx";

// Render the app with full-screen and mouse support
const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: true,
  altScreenBuffer: true,
} as any);

// Wait for the app to exit
await waitUntilExit();
