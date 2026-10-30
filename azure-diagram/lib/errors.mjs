// Carries every problem found in a spec, so an author can fix them in one pass.
export class DiagramError extends Error {
  constructor(problems) {
    const list = [].concat(problems);
    super(list.join('\n'));
    this.name = 'DiagramError';
    this.problems = list;
  }
}
