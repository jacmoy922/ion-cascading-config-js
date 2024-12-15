
export function copyObject(object) {
    return {...(object || {})};
}

export function isObjectEmpty(object) {
    return !object || !Object.keys(object).length;
}

/**
 * Groups items in the list by some key.
 * @param list - the list to apply grouping to
 * @param keySelector - a function to apply to each element of the list and get a resulting "key" used to group items by
 * @param valueMapper - a function to apply to each element of the list and get a resulting "value" which will be grouped by the keys.
 *     This is optional, if it is not passed in then the elements themselves are directly grouped.
 */
export function groupBy(list, keySelector, valueMapper) {
    const mapper = valueMapper || function(item){return item;};
    return list.reduce(function(accumulated, item) {
        const key = keySelector(item);
        accumulated[key] = accumulated[key] || [];
        accumulated[key].push(mapper(item));
        return accumulated;
    }, {});
}

export function removeIf(array, callback) {
    let i = array.length;
    while (i--) {
        if (callback(array[i], i)) {
            array.splice(i, 1);
        }
    }
}

export function setDiff(set1, set2) {
    return new Set([...set1].filter(x => !set2.has(x)));
}

export function setIntersects(set1, set2) {
    return [...set1].some(it => set2.has(it));
}