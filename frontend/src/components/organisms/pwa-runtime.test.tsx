import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PwaProvider, usePwaInstall } from "./pwa-runtime";

function InstallProbe() {
  const pwa = usePwaInstall();

  return (
    <button type="button" disabled={!pwa.canInstall} onClick={() => { void pwa.install(); }}>
      {pwa.isInstalled ? "installed" : pwa.canInstall ? "installable" : "unavailable"}
    </button>
  );
}

describe("PWA installation", () => {
  it("captures an early beforeinstallprompt event and opens the native prompt", async () => {
    const prompt = vi.fn(async () => undefined);
    const installPrompt = new Event("beforeinstallprompt");
    Object.defineProperty(installPrompt, "prompt", { value: prompt });
    Object.defineProperty(installPrompt, "userChoice", {
      value: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });

    window.dispatchEvent(installPrompt);
    render(
      <PwaProvider>
        <InstallProbe />
      </PwaProvider>,
    );

    const button = await screen.findByRole("button", { name: "installable" });
    fireEvent.click(button);

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "installed" })).toBeInTheDocument());
  });
});
