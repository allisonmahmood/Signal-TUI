import { render } from "ink";
import App from "./App.tsx";

// Render the app with full-screen and incremental rendering to prevent flickering
const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: true,
  altScreenBuffer: true,
  incrementalRendering: true,
} as any);

// Wait for the app to exit
await waitUntilExit();
