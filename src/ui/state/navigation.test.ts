import { describe, expect, test } from "bun:test";
import {
  getNextFocusArea,
  jumpListSelection,
  moveListSelection,
  updateChatScrollOffset,
} from "./navigation.ts";

describe("getNextFocusArea", () => {
  test("cycles from sidebar to chat", () => {
    expect(getNextFocusArea("sidebar")).toBe("chat");
  });

  test("cycles from chat to input", () => {
    expect(getNextFocusArea("chat")).toBe("input");
  });

  test("cycles from input to sidebar", () => {
    expect(getNextFocusArea("input")).toBe("sidebar");
  });
});

describe("moveListSelection", () => {
  test("moves selection down within viewport", () => {
    const result = moveListSelection(
      { selectedIndex: 1, scrollOffset: 0, listHeight: 5, itemCount: 10 },
      1
    );

    expect(result.selectedIndex).toBe(2);
    expect(result.scrollOffset).toBe(0);
  });

  test("scrolls viewport when moving beyond visible range", () => {
    const result = moveListSelection(
      { selectedIndex: 4, scrollOffset: 0, listHeight: 5, itemCount: 10 },
      1
    );

    expect(result.selectedIndex).toBe(5);
    expect(result.scrollOffset).toBe(1);
  });

  test("clamps at list boundaries", () => {
    const up = moveListSelection(
      { selectedIndex: 0, scrollOffset: 0, listHeight: 5, itemCount: 10 },
      -1
    );
    const down = moveListSelection(
      { selectedIndex: 9, scrollOffset: 5, listHeight: 5, itemCount: 10 },
      1
    );

    expect(up).toEqual({ selectedIndex: 0, scrollOffset: 0 });
    expect(down).toEqual({ selectedIndex: 9, scrollOffset: 5 });
  });
});

describe("jumpListSelection", () => {
  test("jumps to top", () => {
    const result = jumpListSelection(
      { selectedIndex: 4, scrollOffset: 2, listHeight: 5, itemCount: 10 },
      "top"
    );

    expect(result).toEqual({ selectedIndex: 0, scrollOffset: 0 });
  });

  test("jumps to bottom and aligns viewport", () => {
    const result = jumpListSelection(
      { selectedIndex: 1, scrollOffset: 0, listHeight: 4, itemCount: 10 },
      "bottom"
    );

    expect(result).toEqual({ selectedIndex: 9, scrollOffset: 6 });
  });
});

describe("updateChatScrollOffset", () => {
  test("scrolls one message up/down", () => {
    expect(
      updateChatScrollOffset(
        { scrollOffset: 0, messageCount: 20, visibleCount: 6 },
        "up"
      )
    ).toBe(1);

    expect(
      updateChatScrollOffset(
        { scrollOffset: 1, messageCount: 20, visibleCount: 6 },
        "down"
      )
    ).toBe(0);
  });

  test("scrolls by page size", () => {
    expect(
      updateChatScrollOffset(
        { scrollOffset: 0, messageCount: 20, visibleCount: 6 },
        "pageUp"
      )
    ).toBe(5);

    expect(
      updateChatScrollOffset(
        { scrollOffset: 8, messageCount: 20, visibleCount: 6 },
        "pageDown"
      )
    ).toBe(3);
  });

  test("jumps to oldest/newest bounds", () => {
    expect(
      updateChatScrollOffset(
        { scrollOffset: 4, messageCount: 20, visibleCount: 6 },
        "oldest"
      )
    ).toBe(19);

    expect(
      updateChatScrollOffset(
        { scrollOffset: 10, messageCount: 20, visibleCount: 6 },
        "newest"
      )
    ).toBe(0);
  });
});
