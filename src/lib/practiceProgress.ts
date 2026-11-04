/** Public product-tour practice never modifies learner rewards. */
export function shouldAwardPracticeProgress(awardProgress: boolean): boolean {
  return awardProgress === true;
}