/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentBadge } from "./payment-badge.js";

describe("PaymentBadge", () => {
  it("renders unpaid with amount", () => {
    render(<PaymentBadge status="unpaid" amountDue={150} />);
    expect(screen.getByText(/Unpaid/)).toBeInTheDocument();
  });

  it("renders paid status", () => {
    render(<PaymentBadge status="paid" amountDue={150} />);
    expect(screen.getByText(/Paid/)).toBeInTheDocument();
  });

  it("renders waived and refunded", () => {
    render(<PaymentBadge status="waived" />);
    expect(screen.getByText("Waived")).toBeInTheDocument();
    render(<PaymentBadge status="refunded" />);
    expect(screen.getByText("Refunded")).toBeInTheDocument();
  });

  it("shows partial paid amount", () => {
    render(<PaymentBadge status="partial" amountDue={150} amountPaid={75} currency="PHP" />);
    expect(screen.getByText(/Partial/)).toBeInTheDocument();
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });
});
