import {isObjectEmpty, setIntersects} from "./utils.js";

/**
 * Tests if the given criteria values pass the predicate's condition.
 *
 * @param criteriaValues A Set of criteria values from config, non-null.
 * @return True if these values pass the predicate.
 */
function newCriteriaPredicate(predicate) {
    return {
        _type: "CriteriaPredicate",
        test: predicate
    };
}

function newIntersectsSetCriteriaPredicate(valueSet) {
    return newCriteriaPredicate((criteriaValues) => setIntersects(valueSet, criteriaValues));
}

function newContainsStringCriteriaPredicate(value) {
    return newCriteriaPredicate((criteriaValues) => criteriaValues.has(value));
}

function fromValues() {
    if (arguments.length === 1) {
        const arg = arguments[0];
        return arg instanceof Set
            ? new newIntersectsSetCriteriaPredicate(arg)
            : this.fromValue(arg);
    }

    const valueSet = arguments.length === 0
        ? new Set([])
        : new Set([...arguments]);
    return new newIntersectsSetCriteriaPredicate(valueSet);
}

/**
 * Used in the {@link IonConfigManager#getValuesForPredicates(String, Map)} method allowing callers to create custom
 * logic to check if a criteria passes when processing IonCascadingConfig.
 */
export const CriteriaPredicate = {
    /**
     * A criteria predicate that always returns false.
     */
    ALWAYS_FALSE: newCriteriaPredicate(() => false),
    /**
     * A convenience CriteriaPredicate factory that checks if the Set of criteria values are contained within the given
     * values.
     *
     * @param values A series of values to check against.
     * @return True if any of the criteria values are contained in the given values.
     */
    fromValues,
    /**
     * A convenience CriteriaPredicate factory that checks if the given string is contained within the Set of criteria
     * values.
     *
     * @param value A String to check against.
     * @return True if any of the criteria values equal the given String.
     */
    fromValue: function(value) {
        return newContainsStringCriteriaPredicate(value);
    },
    /**
     * A convenience CriteriaPredicate factory. Using the given predicate, this creates a criteria predicate which
     * checks if any String in the Set of criteria equal it.
     *
     * @param condition A predicate which acts on a single string instead of the entire Set.
     * @return True if any of the criteria values pass the given predicate.
     */
    fromCondition: function(condition) {
        return newCriteriaPredicate((criteriaValues) => [...criteriaValues].some(condition));
    },
    /**
     * Converts a Map of key value pairs into a Map of key to criteria predicates using the {@link #fromValue(String)}
     * factory.
     *
     * @param properties A Map of key value pairs.
     * @return A Map of key to criteria predicates.
     */
    convertStringMap: function(properties) {
        if (isObjectEmpty(properties)) {
            return {};
        }

        return Object.entries(properties).reduce((acc, [key, value]) => {
            acc[key] = newContainsStringCriteriaPredicate(value);
            return acc;
        }, {});
    },
    /**
     * Converts a Map of key to value set pairs into a Map of key to criteria predicates using the #fromValues(Set) factory.
     *
     * @param properties A Map of key value pairs.
     * @return A Map of key to criteria predicates.
     */
    convertStringSetMap: function(properties) {
        if (isObjectEmpty(properties)) {
            return {};
        }

        return Object.entries(properties).reduce((acc, [key, value]) => {
            acc[key] = fromValues(value);
            return acc;
        }, {});
    }
};
