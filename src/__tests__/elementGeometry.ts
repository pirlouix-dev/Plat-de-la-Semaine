/**
 * jsdom performs no layout, so `clientHeight` / `scrollHeight` are always 0 and
 * overflow detection can never trigger. These helpers let a test fix the box
 * metrics of every element, which is enough to exercise the overflow logic.
 */
let clientHeight = 0;
let scrollHeight = 0;

export function setElementGeometry(client: number, scroll: number): void {
  clientHeight = client;
  scrollHeight = scroll;
}

export function installElementGeometryMock(): () => void {
  const clientDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientHeight",
  );
  const scrollDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "scrollHeight",
  );

  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });

  return () => {
    if (clientDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientHeight",
        clientDescriptor,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
    if (scrollDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollHeight",
        scrollDescriptor,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    }
    clientHeight = 0;
    scrollHeight = 0;
  };
}
