import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("frontend foundation", () => {
  it("exposes the technical application entry point", () => {
    render(<Home />);

    expect(screen.getByText("ARES PATH")).toBeInTheDocument();
  });
});
