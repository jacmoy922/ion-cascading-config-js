import {copyObject, isObjectEmpty} from "./utils.js";
import {CriteriaPredicate} from "./CriteriaPredicate.js";

export const NamespacedIonConfigManager = {
    create: createNamespacedIonConfigManager
};

function createNamespacedIonConfigManager(options) {
    if (!options.namespace) {
        throw `"namespace" must be defined!`;
    }
    const namespace = options.namespace;
    if (!options.configManager) {
        throw `"configManager" must be defined!`;
    }
    const globalConfigManager = options.configManager;

    const defaultProperties = copyObject(options.defaultProperties);
    const defaultPredicates = {...copyObject(options.defaultPredicates), ...CriteriaPredicate.convertStringMap(defaultProperties)};
    const defaultValues = globalConfigManager.getValuesForPredicates(namespace, defaultPredicates);
    const queriesCacheResults = !!options.queriesCacheResults;

    return {
        newQuery
    };

    /**
     * Finds all values from the config that match the given predicates combined with the default predicates.
     *
     * @param additionalPredicates Any additional properties to add to the default properties. Can be null.
     * @return A Map<String, IonValue> containing all the values matching the predicates.
     */
    function lookupValues(additionalPredicates) {
        // exit early if there is nothing new to lookup
        if (isObjectEmpty(additionalPredicates)) {
            return newLookupResult(defaultPredicates, defaultValues);
        }

        // lookup new values by combining the new predicates with the default ones
        const combinedPredicates = {...defaultPredicates, ...additionalPredicates};
        const values = globalConfigManager.getValuesForPredicates(namespace, combinedPredicates);
        return newLookupResult(combinedPredicates, values);
    }

    function newLookupResult(inputPredicates, outputValues) {
        return {
            _type: "LookupResult",
            inputPredicates,
            outputValues
        };
    }

    function newQuery() {
        const state = {
            additionalPredicates: {}, // Map<String, CriteriaPredicate>
            additionalProperties: {}, // Map<String, Set<String>>
            additionalPropertiesAdded: false,
            shouldCacheResults: !!queriesCacheResults,
            cachedResults: null
        };
        return {
            cacheResults: function(cacheResults) {
                state.shouldCacheResults = !!cacheResults;
                return this;
            },
            doCacheResults: function() {
                state.shouldCacheResults = true;
                return this;
            },
            doNotCacheResults: function() {
                state.shouldCacheResults = false;
                return this;
            },
            withProperties: function(values) {
                Object.entries(values).forEach(([key, value]) => {
                    state.additionalProperties[key] = state.additionalProperties[key] || new Set([]);
                    state.additionalProperties[key].add(value);
                });
                state.additionalPropertiesAdded = true;
                return this;
            },
            withProperty: function(key, value) {
                state.additionalProperties[key] = state.additionalProperties[key] || new Set([]);
                state.additionalProperties[key].add(value);
                state.additionalPropertiesAdded = true;
                return this;
            },
            withPredicates: function(predicates) {
                state.additionalPredicates = {...state.additionalPredicates, ...predicates};
                state.additionalPropertiesAdded = true;
                return this;
            },
            withPredicate: function(key, predicate) {
                state.additionalPredicates[key] = predicate;
                state.additionalPropertiesAdded = true;
                return this;
            },
            clear: function() {
                state.additionalPredicates = {};
                state.additionalProperties = {};
                state.additionalPropertiesAdded = false;
                return this;
            },
            findOrNull: function(key) {
                return findKey(key, false);
            },
            findOrThrow: function(key) {
                return findKey(key, true);
            },
            findAll: function() {
                return lookupAll().outputValues;
            }
        };

        function findKey(key, throwIfEmpty) {
            // convert properties to predicates and add to the predicates map, if anything has been added
            const lookupResult = lookupAll();
            const value = lookupResult.outputValues[key];
            if (!!throwIfEmpty && !value) {
                throw `Could not find key ${key} with criteria ${JSON.stringify(lookupResult.inputPredicates)}.`;
            }
            return value;
        }

        function lookupAll() {
            // convert properties to predicates and add to the predicates map, if anything has been added
            if (state.additionalPropertiesAdded) {
                state.additionalPredicates = {...state.additionalPredicates, ...CriteriaPredicate.convertStringSetMap(state.additionalProperties)};

                // reset state so config is evaluated again
                state.additionalProperties = {};
                state.additionalPropertiesAdded = false;
                state.cachedResults = null;
            }

            // check if we should use the cached values
            if (state.shouldCacheResults) {
                // fetch the results if necessary, caching them to the state then return them.
                if (state.cachedResults === null) {
                    state.cachedResults = lookupValues(state.additionalPredicates);
                }
                return state.cachedResults;

            } else {
                // we don't want to cache the results so we should look them up and clear the cached value
                state.cachedResults = null;
                return lookupValues(state.additionalPredicates);
            }
        }
    }
}