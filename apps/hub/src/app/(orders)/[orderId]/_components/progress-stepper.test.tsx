import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressStepper } from "./progress-stepper";
import type { OrderStatus } from "@/stores/order-store";

describe("ProgressStepper", () => {
  it("renders all four steps", () => {
    render(<ProgressStepper status="quoted" />);

    expect(screen.getByText("Quoted")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("marks Quoted as current when status is quoted", () => {
    render(<ProgressStepper status="quoted" />);

    const step = screen.getByTestId("step-quoted");
    expect(step).toHaveAttribute("data-state", "current");
  });

  it("marks Quoted as completed and Paid as current when status is paid", () => {
    render(<ProgressStepper status="paid" />);

    expect(screen.getByTestId("step-quoted")).toHaveAttribute("data-state", "completed");
    expect(screen.getByTestId("step-paid")).toHaveAttribute("data-state", "current");
  });

  it("marks first three as completed and Delivered as current when delivered", () => {
    render(<ProgressStepper status="delivered" />);

    expect(screen.getByTestId("step-quoted")).toHaveAttribute("data-state", "completed");
    expect(screen.getByTestId("step-paid")).toHaveAttribute("data-state", "completed");
    expect(screen.getByTestId("step-processing")).toHaveAttribute("data-state", "completed");
    expect(screen.getByTestId("step-delivered")).toHaveAttribute("data-state", "current");
  });

  it("shows error state on current step when delivery_failed", () => {
    render(<ProgressStepper status="delivery_failed" />);

    // Processing step should show error since that's where failure occurs
    expect(screen.getByTestId("step-processing")).toHaveAttribute("data-state", "error");
  });

  it("shows error state on current step when failed", () => {
    render(<ProgressStepper status="failed" />);

    expect(screen.getByTestId("step-processing")).toHaveAttribute("data-state", "error");
  });

  it("treats paying status same as quoted for stepper display", () => {
    render(<ProgressStepper status="paying" />);

    expect(screen.getByTestId("step-quoted")).toHaveAttribute("data-state", "current");
    expect(screen.getByTestId("step-paid")).toHaveAttribute("data-state", "upcoming");
  });

  it("marks upcoming steps correctly", () => {
    render(<ProgressStepper status="quoted" />);

    expect(screen.getByTestId("step-paid")).toHaveAttribute("data-state", "upcoming");
    expect(screen.getByTestId("step-processing")).toHaveAttribute("data-state", "upcoming");
    expect(screen.getByTestId("step-delivered")).toHaveAttribute("data-state", "upcoming");
  });
});
