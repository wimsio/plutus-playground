import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";

describe("frontend App", () => {
  it("renders starter heading", () => {
    render(<App />);
    expect(screen.getByText(/Full-Stack Starter/i)).toBeTruthy();
  });
});
