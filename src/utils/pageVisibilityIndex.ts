export const findFirstIndexByBottom = (cumulativePageBottoms: number[], threshold: number): number => {
  let left = 0;
  let right = cumulativePageBottoms.length - 1;
  let answer = cumulativePageBottoms.length;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    if (cumulativePageBottoms[middle] >= threshold) {
      answer = middle;
      right = middle - 1;
    } else {
      left = middle + 1;
    }
  }

  return answer;
};

export const findLastIndexByTop = (cumulativePageTops: number[], threshold: number): number => {
  let left = 0;
  let right = cumulativePageTops.length - 1;
  let answer = -1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    if (cumulativePageTops[middle] <= threshold) {
      answer = middle;
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return answer;
};
