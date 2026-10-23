// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getCloseMatches, similarity } from "./difflib";

// Expected values were produced by CPython's difflib, so vendor matching is unchanged by the port.
describe("difflib port", () => {
  it("matches SequenceMatcher.ratio", () => {
    expect(similarity("amazon", "amzn mktp")).toBeCloseTo(0.533333, 6);
    expect(similarity("amzn mktp us", "amzn mktp")).toBeCloseTo(0.857143, 6);
    expect(similarity("starbucks", "starbucks coffee")).toBeCloseTo(0.72, 6);
    expect(similarity("", "")).toBe(1);
  });

  it("applies CPython's autojunk heuristic to long sequences", () => {
    expect(similarity("a".repeat(250), "a".repeat(250) + "b")).toBeCloseTo(0.998004, 6);
  });

  it("returns the best match above the cutoff, like get_close_matches", () => {
    expect(getCloseMatches("amzn mktp", ["amazon", "amazon.com", "amzn mktp us"], 1, 0.8)).toEqual(["amzn mktp us"]);
    expect(getCloseMatches("starbucks coffee", ["starbucks", "starbuck"], 1, 0.8)).toEqual([]);
    expect(getCloseMatches("uber", ["uber eats", "uber trip"], 1, 0.8)).toEqual([]);
  });

  it("orders ties by the larger string and honours n", () => {
    expect(getCloseMatches("ab", ["ab", "ab"], 2, 0.5)).toEqual(["ab", "ab"]);
    expect(getCloseMatches("abcd", ["abce", "abcf", "abcd"], 2, 0.5)).toEqual(["abcd", "abcf"]);
  });
});
