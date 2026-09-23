import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UploadZone from "./UploadZone";
import { UploadError, DeleteError } from "./Alerts";
import { renderWithProviders } from "@/test/render";

function setup(overrides: Partial<React.ComponentProps<typeof UploadZone>> = {}) {
  const props = {
    isUploading: false,
    uploadProgress: 0,
    dragActive: false,
    onUpload: vi.fn(),
    setDragActive: vi.fn(),
    onValidationError: vi.fn(),
    ...overrides,
  };
  const utils = renderWithProviders(<UploadZone {...props} />);
  const input = utils.container.querySelector<HTMLInputElement>("#file-upload")!;
  return { ...utils, props, input };
}

describe("UploadZone", () => {
  it("restricts the picker to supported types", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("accept", "application/pdf,image/jpeg,image/png");
    expect(screen.getByText("PDF, JPG, PNG up to 10MB")).toBeInTheDocument();
  });

  it("uploads a valid file chosen from the picker", async () => {
    const { input, props } = setup();
    const file = new File(["%PDF"], "invoice.pdf", { type: "application/pdf" });

    await userEvent.upload(input, file);

    expect(props.onUpload).toHaveBeenCalledWith(file);
    expect(props.onValidationError).not.toHaveBeenCalled();
    expect(screen.getByText("Selected: invoice.pdf")).toBeInTheDocument();
  });

  it("reports validation errors instead of uploading", () => {
    const { input, props } = setup();
    fireEvent.change(input, {
      target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });

    expect(props.onUpload).not.toHaveBeenCalled();
    expect(props.onValidationError).toHaveBeenCalledWith(
      expect.stringMatching(/^Unsupported file extension/)
    );
  });

  it("handles drag-and-drop", () => {
    const { container, props } = setup();
    const zone = container.querySelector(".border-dashed")!;
    const file = new File(["img"], "receipt.png", { type: "image/png" });

    fireEvent.dragEnter(zone);
    expect(props.setDragActive).toHaveBeenLastCalledWith(true);
    fireEvent.dragLeave(zone);
    expect(props.setDragActive).toHaveBeenLastCalledWith(false);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(props.onUpload).toHaveBeenCalledWith(file);
  });

  it("shows upload progress", () => {
    setup({ isUploading: true, uploadProgress: 40 });
    expect(screen.getByText("Uploading... 40%")).toBeInTheDocument();
  });
});

describe("dashboard alerts", () => {
  it("render nothing without a message", () => {
    const { container } = render(
      <>
        <UploadError message="" onDismiss={vi.fn()} />
        <DeleteError message="" onDismiss={vi.fn()} />
      </>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("announce the error and can be dismissed", async () => {
    const onDismiss = vi.fn();
    renderWithProviders(<DeleteError message="Failed to delete document." onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to delete document.");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("upload error is dismissible too", async () => {
    const onDismiss = vi.fn();
    renderWithProviders(<UploadError message="Upload failed." onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
