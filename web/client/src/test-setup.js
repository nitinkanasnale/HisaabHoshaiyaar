import { vi } from "vitest";
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
HTMLDialogElement.prototype.showModal = vi.fn(function () {
  this.setAttribute("open", "");
});
HTMLDialogElement.prototype.close = vi.fn(function () {
  this.removeAttribute("open");
});
