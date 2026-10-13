import { deepFreeze } from "./internal.js";

export type ConformanceObserved<T> =
  | { readonly kind: "returned"; readonly value: T }
  | {
      readonly kind: "exception";
      readonly errorName: string;
      readonly message: string;
    };

export interface ConformanceFixture<TInput, TExpected> {
  readonly id: string;
  readonly input: TInput;
  readonly expected: TExpected;
}

export interface ConformanceFailure<TExpected, TObserved> {
  readonly fixtureId: string;
  readonly expected: TExpected;
  readonly observed: ConformanceObserved<TObserved>;
}

export interface ConformanceReport<TExpected, TObserved> {
  readonly schema: "contract.conformance-report/v1";
  readonly passed: boolean;
  readonly fixtureCount: number;
  readonly failures: readonly ConformanceFailure<TExpected, TObserved>[];
}

export function runConformance<TInput, TExpected, TObserved>(
  input: {
    readonly fixtures: readonly ConformanceFixture<TInput, TExpected>[];
    readonly implementation: (input: Readonly<TInput>) => TObserved;
    readonly equivalent: (
      expected: TExpected,
      observed: ConformanceObserved<TObserved>,
    ) => boolean;
  },
): ConformanceReport<TExpected, TObserved> {
  const failures: ConformanceFailure<TExpected, TObserved>[] = [];

  for (const fixture of input.fixtures) {
    let observed: ConformanceObserved<TObserved>;
    try {
      const isolated = deepFreeze(structuredClone(fixture.input));
      observed = {
        kind: "returned",
        value: input.implementation(isolated),
      };
    } catch (error) {
      observed = {
        kind: "exception",
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    let equivalent = false;
    try {
      equivalent = input.equivalent(fixture.expected, observed);
    } catch {
      equivalent = false;
    }

    if (!equivalent) {
      failures.push({
        fixtureId: fixture.id,
        expected: fixture.expected,
        observed,
      });
    }
  }

  return Object.freeze({
    schema: "contract.conformance-report/v1",
    passed: failures.length === 0,
    fixtureCount: input.fixtures.length,
    failures: Object.freeze(failures.map((failure) => Object.freeze(failure))),
  });
}
