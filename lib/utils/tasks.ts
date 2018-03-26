import { Either, left, right } from "fp-ts/lib/Either";
import { Task } from "fp-ts/lib/Task";
import { fromEither, TaskEither } from "fp-ts/lib/TaskEither";

export const fromTask = <L, R>(p: () => Promise<Either<L, R>>) =>
  new TaskEither(new Task(p));

export function processTaskEithers<L, A>(
  a: TaskEither<L, A>
): TaskEither<L, [A]>;

export function processTaskEithers<L1, L2, A, B>(
  a: TaskEither<L1, A>,
  b: TaskEither<L2, B>
): TaskEither<L1 | L2, [A, B]>;

export function processTaskEithers<L1, L2, L3, A, B, C>(
  a: TaskEither<L1, A>,
  b: TaskEither<L2, B>,
  c: TaskEither<L3, C>
): TaskEither<L1 | L2 | L3, [A, B, C]>;

export function processTaskEithers<L1, L2, L3, L4, A, B, C, D>(
  a: TaskEither<L1, A>,
  b: TaskEither<L2, B>,
  c: TaskEither<L3, C>,
  d: TaskEither<L4, D>
): TaskEither<L1 | L2 | L3 | L4, [A, B, C, D]>;

export function processTaskEithers<L1, L2, L3, L4, L5, A, B, C, D, E>(
  a: TaskEither<L1, A>,
  b: TaskEither<L2, B>,
  c: TaskEither<L3, C>,
  d: TaskEither<L4, D>,
  e: TaskEither<L5, E>
): TaskEither<L1 | L2 | L3 | L4 | L5, [A, B, C, D, E]>;

export function processTaskEithers<L1, L2, L3, L4, L5, L6, A, B, C, D, E, F>(
  a: TaskEither<L1, A>,
  b: TaskEither<L2, B>,
  c: TaskEither<L3, C>,
  d: TaskEither<L4, D>,
  e: TaskEither<L5, E>,
  f: TaskEither<L6, F>
): TaskEither<L1 | L2 | L3 | L4 | L5 | L6, [A, B, C, D, E, F]>;

/**
 * Run tasks sequentially and collect eithers results into an array.
 * Stops processing and exits with a left value on first error.
 *
 * @return Promise<right([results])> on success
 * @return Promise<left(response)> on error
 */
export function processTaskEithers<L, A>(
  // tslint:disable-next-line:readonly-array
  ...tasks: Array<TaskEither<L, A>>
): TaskEither<L, ReadonlyArray<A>> {
  return tasks.reduce(
    (prev, task) =>
      fromTask(() =>
        prev
          .run()
          .then(errorOrResults =>
            errorOrResults.fold(
              l => Promise.resolve(left(l)),
              ar =>
                task
                  .run()
                  .then(errorOrResult =>
                    errorOrResult.map(result => [...ar, result])
                  )
            )
          )
          .catch(err => left(err))
      ),
    fromEither(right([]))
  );
}
