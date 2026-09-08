import { describe, expect, it } from "vitest";
import { extractJSON } from "@/lib/extractJSON";

describe("extractJSON", () => {
  it("parses clean JSON", () => {
    expect(extractJSON('{"score":80}')).toEqual({ score: 80 });
  });

  it("strips json code fences", () => {
    expect(extractJSON('```json\n{"score":80}\n```')).toEqual({ score: 80 });
  });

  it("strips plain code fences", () => {
    expect(extractJSON('```\n{"score":80}\n```')).toEqual({ score: 80 });
  });

  it("extracts JSON when wrapped in prose", () => {
    const raw =
      'Here is the result: {"score":75,"strong":[],"gaps":[],"recommendation":"OK"} Hope that helps.';

    expect(extractJSON(raw)).toEqual({ score: 75, strong: [], gaps: [], recommendation: "OK" });
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJSON("No JSON here")).toThrow();
  });
});