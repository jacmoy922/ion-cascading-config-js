import * as ION from "ion-js";
import {isObjectEmpty, groupBy, removeIf, setDiff} from "./utils.js";
import {CriteriaPredicate} from "./CriteriaPredicate.js";

const SUB_FIELD_VALUE_KEYWORD = "value";
const SUB_FIELD_VALUES_KEYWORD = "values";

export const IonConfigManager = {
    /**
     * Creations an IonConfigManager from one or more lists of name->ion pairs. The format of these lists should be
     * ```
     * [{name:"ion from S3", ionValue}, {name:"ion from static config", ionValue}, ...]
     * ```
     */
    fromIonValues: function() {
        return createIonConfigManager([...arguments].flatMap((it) => it));
    },
    fromIonValue: function(name, ionValue) {
        return this.fromIonValues([{name, ionValue}]);
    },
    fromString: function(name, ionString) {
        return this.fromIonValues(ION.loadAll(ionString).map(it => {
            return {name, ionValue: it};
        }));
    }
};

function createIonConfigManager(records) {
    // declare private member fields
    const namespacedProperties = {};

    // runs constructor to populate member fields
    runConstructor(records);

    // return an object exposing the public API
    return {
        /**
         * Allows callers to pass in custom methods to check the values of properties. The bulk condition will be passed a
         * Set of the criteria values from the config and if it returns true, the data values associated with that criteria
         * will be factored into the result, following normal cascading processing.
         *
         * If the same config key is specified in config multiple times at the same prioritization, the particular value
         * that is chosen is non-deterministic and may vary between instances.
         *
         * @param namespace The namespace to check within.
         * @param predicates A Map of names to CriteriaPredicates.
         * @return A Map of String to IonValues as a result of processing the config.
         */
        getValuesForPredicates: function(namespace, predicates) {
            return getValuesByCondition(namespace, (criteria) => (predicates[criteria.key] || CriteriaPredicate.ALWAYS_FALSE).test(criteria.values));
        },
        /**
         * Processes the IonCascadingConfig to produce a resulting map of property keys to their Ion values. A criteria will
         * only be considered to pass if it is the same as the property value with the same key.
         *
         * @param namespace The namespace to check within.
         * @param properties A Map of property names to allowed values.
         * @return A Map of String to IonValues as a result of processing the config.
         */
        getValuesForProperties: function(namespace, properties) {
            // check if the input property is contained in the configured property set
            return getValuesByCondition(namespace, (entry) => entry.values.has(properties[entry.key]));
        }
    };

    function getValuesByCondition(namespace, condition) {
        const properties = namespacedProperties[namespace] || [];
        const aggregatedValues = cascadeMatchableProperties(properties, condition);
        return Object.entries(aggregatedValues).reduce((acc, [key, value]) => {
            acc[key] = value.getIonValue(condition);
            return acc;
        }, {});
    }

    /**
     * Iterates over the sorted properties, checking if each one matches and if so, adding it to an aggregate map of
     * values.
     *
     * @param sortedProperties A sorted list of MatchableProperty.
     * @param condition A predicate to check for each matchable property to see if it should be added to the aggregate
     * map.
     * @return The aggregate map.
     */
    function cascadeMatchableProperties(sortedProperties, condition) {
        let aggregatedValues = {};
        sortedProperties.forEach(matchableProperty => {
            // loop over matchable properties and aggregate their values into a single map
            // properties matched later might overwrite properties that were matched earlier, thus the cascading effect
            if (matchableProperty.criteria.every((criteriaDefinition) => criteriaDefinition.testCondition(condition))) {
                aggregatedValues = {...aggregatedValues, ...matchableProperty.values};
            }
        });
        return aggregatedValues;
    }

    // constructor, populates member fields
    function runConstructor(records) {
        const namespacedPriorities = {};

        // a map to keep track of all property lists that we must sort after the config is parsed
        const namespacedPropertyListsToSort = {};

        records.forEach(({name, ionValue}) => {
            verify(!!ionValue, name, "Null/undefined ionValue record was passed.");
            verify(!!ionValue.isNull, name, "ionValue record is not actually ion.");
            verify(!ionValue.isNull(), name, "ionValue record is a null ion with no namespace.");

            verifyNamespaceDeclaration(ionValue.getType().name === "struct", name, ionValue);

            const annotations = ionValue.getAnnotations();
            verify(!!annotations && annotations.length, name, "Found unnamespaced config.");

            if ("namespace" === annotations[0].toLowerCase()) {
                verifyNamespaceDeclaration(annotations.length === 2, name, ionValue);

                const namespace = annotations[1];
                verify(!Object.prototype.hasOwnProperty.call(namespacedPriorities, namespace), name, `Namespace ${namespace} is declared more than once.`);

                const rawPriorities = ionValue.get("prioritizedCriteria");
                verifyNamespaceDeclaration(isIonList(rawPriorities), name, ionValue);

                const parsedPriorities = [...rawPriorities].map(it => {
                    verifyNamespaceDeclaration(!!it && !it.isNull() && isIonText(it), name, ionValue);
                    return it.stringValue();
                });

                namespacedPriorities[namespace] = parsedPriorities;
                return;
            }

            // created a list of properties for each namespace, this will be sorted and filtered according to the
            // priorities after everything has been read. The priorities won't all be guaranteed to be read until this
            // stream is completed.
            const namespace = annotations[0];
            const propertyListsToSort = [];
            namespacedPropertyListsToSort[namespace] = propertyListsToSort;
            const properties = parseMatchablePropertiesRecursive(name, ionValue, [], propertyListsToSort);

            // combine all configurations for the same namespace together, the first annotation is the namespace
            namespacedProperties[namespace] = [...(namespacedProperties[namespace] || []), ...properties];
        });

        // add the top-level property list to the sort map so it is also sorted
        Object.entries(namespacedProperties).forEach(([namespace, properties]) => namespacedPropertyListsToSort[namespace].push(properties));

        // begin filtering and sorting configurations now that all configurations have been loaded
        const namespacesWithProperties = new Set(Object.keys(namespacedPropertyListsToSort));
        const declaredNamespaces = new Set(Object.keys(namespacedPriorities));
        const undeclaredNamspaces = [...setDiff(namespacesWithProperties, declaredNamespaces)];
        if (undeclaredNamspaces.length) {
            throw `Found ${undeclaredNamspaces.length} undeclared namespaces. ${JSON.stringify(undeclaredNamspaces)}`;
        }

        Object.entries(namespacedPropertyListsToSort).forEach(([namespace, propertyLists]) => {
            const priorities = namespacedPriorities[namespace];

            const indexedPriorities = priorities.reduce((accumulator, priority, index) => {
                accumulator[priority] = index;
                return accumulator;
            }, {});

            propertyLists.forEach(properties => {
                // remove any MatchableProperties that contain an invalid criteria (if the criteria was not specified in the priorities list for this namespace)
                const invalidCriteria = properties.filter(matchableProperty =>
                    matchableProperty.criteria.some(criterion => !Object.prototype.hasOwnProperty.call(indexedPriorities, criterion.name))
                );
                if (invalidCriteria.length) {
                    throw `Namespace ${namespace} contains criteria which are not defined in its priorities. Invalid criteria:${JSON.stringify(invalidCriteria)}`;
                }

                // remove unnecessary matchable properties which contain no values
                removeIf(properties, (matchableProperty) => isObjectEmpty(matchableProperty.values));

                // sort each MatchableProperty's criteria list according to the priority of the individual fields
                // see README.md for more details on how the algorithm needs to perform

                // first sort each property's criteria from most to least specific
                properties.forEach(matchableProperty => matchableProperty.criteria.sort((a, b) => {
                    const priorityA = indexedPriorities[a.name];
                    const priorityB = indexedPriorities[b.name];
                    return priorityB - priorityA;
                }));

                // sort the entire list of MatchableProperties by their total priority

                // give each element of the list an order of magnitude more importance than all following elements so
                // a criteria is more important than all less criteria combined but that criteria combined with another
                // less criteria is more important than by itself.
                // For example if our prioritizedCriteria are [a, b, c, d, e, f, g, ... z]
                // then [a] < [b] < [y ... a] < [z] < [z, a] < [z, b, a] < [z, c] ...
                properties.sort((a, b) => {
                    const prioritiesSize = indexedPriorities.length;

                    // use BigInts to prevent overflows when dealing with powers
                    const prioritiesSizeBigInt = BigInt(prioritiesSize);
                    const aScore = computeMatchablePropertyPriority(a);
                    const bScore = computeMatchablePropertyPriority(b);
                    if (aScore > bScore) {
                        return 1;
                    } else if (aScore < bScore) {
                        return -1;
                    } else {
                        return 0;
                    }

                    function computeMatchablePropertyPriority(matchableProperty) {
                        const criteriaList = matchableProperty.criteria;
                        return criteriaList.reduce((currentPriority, item, _) => {
                            // raise elements to magnitude size = priority size to ensure it is more important than all following elements
                            const criteriaPriorityValue = (prioritiesSizeBigInt ** (prioritiesSize - 1)) * BigInt(indexedPriorities[item.name] + 1);
                            return currentPriority + criteriaPriorityValue;
                        }, BigInt(0));
                    }
                });
            });
        });
    }

    /**
     * Parses an IonStruct to create a Stream of MatchableProperties that can be used later for cascading together to
     * retrieve a value.
     *
     * @param recordName The name of the file that this IonStruct is contained within.
     * @param config The IonStruct to parse.
     * @param currentCriteria The current list of criteria that scope this struct.
     * @param matchablePropertiesToSort A list of lists of MatchableProperties that must be sorted after all parsing is
     * completed. New lists of Matchable Properties may be added to it.
     * @return A list of MatchableProperties
     */
    function parseMatchablePropertiesRecursive(recordName, configStruct, currentCriteria, matchablePropertiesToSort) {
        if (configStruct.fieldNames().length === 0) {
            return [];
        }

        const values = {};
        const currentProperty = newMatchableProperty(currentCriteria, values);

        let results = [currentProperty];
        configStruct.allFields().forEach(([fieldName, [fieldValue]]) => {
            // the ionValue can either be a criteria definition or a value, check for it being a value first to short-circuit
            const criterionDefinition = parseCriterionDefinition(fieldName);
            if (criterionDefinition === null) {
                values[fieldName] = parseIonPropertyRecursive(recordName, fieldValue, matchablePropertiesToSort);
                return;
            }


            // the original java implementation was using streams and evaluation was lazy, so this for-loop was evaluated completely before it dug deeper
            // into these recursive calls. Effectively it was breadth-first build up. Now without streams, its eager, meaning the recursion is done first
            // and the for-loop is done last, making it depth-first. It all gets sorted in the end anyways so I don't expect any difference in terms of
            // function or performance, but it is worth noting in case its a problem later
            // TODO delete this comment before releasing if no issue is noticed since this isn't necessarily a problem, more of a helpful pointer to
            // myself in case I run into problems while implementing.
            results = [...results, ...parseCriteriaDefinitionsRecursive(recordName, fieldValue, currentCriteria, matchablePropertiesToSort, criterionDefinition)];
        });

        return results;
    }

    /**
     * Creates an IonProperty by parsing the given IonValue.
     *
     * @param recordName The name of the file that this IonValue is contained within.
     * @param ionValue The IonValue to parse.
     * @param matchablePropertiesToSort A list of lists of MatchableProperties that must be sorted after all parsing is
     * completed. New lists of Matchable Properties may be added to it.
     * @return An IonProperty
     */
    function parseIonPropertyRecursive(recordName, ionValue, matchablePropertiesToSort) {
        if (isIonStruct(ionValue) && ionValue.allFields().some(([_, [fieldValue]]) => couldBeDynamic(fieldValue))) {
            const subProperties = parseMatchablePropertiesRecursive(recordName, ionValue, [], matchablePropertiesToSort);
            matchablePropertiesToSort += subProperties;
            return newDynamicIonStruct(subProperties);
        }

        if (isIonList(ionValue) && ionValue.some((item) => couldBeDynamic(item))) {
            const listProperties = [...ionValue].map(rawListValue => {
                // check if this a sub field
                const annotations = rawListValue.getAnnotations();
                if (!!annotations.length && parseCriterionDefinition(annotations[0]) !== null) {
                    verify(isIonStruct(rawListValue), recordName,
                        `Criterion definition field must be a non-null struct but was a ${createTypeString(rawListValue)}`);
                    verify(rawListValue.allFields().length === 1, recordName, "A list sub-field criteria must contain exactly 1 value.");

                    // parse the sub field, add it to the sort list then verify that it has the necessary structure
                    const subField = parseCriteriaDefinitionsRecursive(recordName, rawListValue, [], matchablePropertiesToSort)
                        // remove unnecessary matchable properties which contain no values
                        .filter(matchableProperty => !isObjectEmpty(matchableProperty.values));

                    matchablePropertiesToSort.push(subField);

                    // validate subField further
                    subField.forEach(property => {
                        const subFieldFieldNames = Object.keys(property.values);
                        verify(subFieldFieldNames.length === 1, recordName, "A list sub-field criteria must contain exactly 1 value.");
                        const subFieldName = subFieldFieldNames[0];

                        // verify the field is one of the allowed names
                        const allowedSubListValueKeywords = [SUB_FIELD_VALUE_KEYWORD, SUB_FIELD_VALUES_KEYWORD];
                        verify(allowedSubListValueKeywords.includes(subFieldName), recordName, `A sub-list criteria must contain exactly 1 ` +
                            `field named one of ${allowedSubListValueKeywords} but actually was ${subFieldName}`);

                        // if it is "values" verify it is a list
                        verify(subFieldName === SUB_FIELD_VALUE_KEYWORD || property.values[subFieldName].isListBased(), recordName,
                            `A sub-list criteria with name "values" must be a list.`);
                    });
                    return newDynamicIonSubField(subField);
                }
                return parseIonPropertyRecursive(recordName, rawListValue, matchablePropertiesToSort);
            });
            return newDynamicIonList(listProperties);
        }

        return newBasicIonProperty(ionValue);
    }

    /**
     * Verifies the given ionValue is a struct, treats all annotations as CriterionDefinitions, and then recursively
     * parses it for MatchableProperties.
     */
    function parseCriteriaDefinitionsRecursive(recordName, ionValue, currentCriteria, matchablePropertiesToSort, additionalCriterion) {
        verify(isIonStruct(ionValue), recordName, `Criterion definition field must be a non-null struct but was a ${createTypeString(ionValue)}`);

        // group all "or" conditions together by criteria names and putting all the criteria values into a set for O(1) lookup
        const combinedOrPropertiesMap = groupBy([
            additionalCriterion,
            ...ionValue.getAnnotations().map(potentialCriteria => {
                const orCriterion = parseCriterionDefinition(potentialCriteria);
                verify(!!orCriterion, recordName, `Could not parse 'OR' criterion from string. It must be in the format 'key-value'. Input: ${potentialCriteria}`);
                return orCriterion;
            })
        ].filter(Boolean), (item) => JSON.stringify(item.identifier), (item) => item.value);

        return Object.entries(combinedOrPropertiesMap).map(([criteriaName, criteriaValues]) => {
            // dedupe each grouped list of properties
            const values = [...new Set(criteriaValues)];

            return [
                ...currentCriteria,
                newGroupedCriteriaDefinition(JSON.parse(criteriaName), values)
            ];
        })
        .flatMap(criteria => parseMatchablePropertiesRecursive(recordName, ionValue, criteria, matchablePropertiesToSort));
    }

    /**
     * Represents a criterion as defined in config. For example:
     *
     * ```
     *  'color-blue': {
     *      ...
     *  }
     * ```
     *
     * Would have a CriterionDefinition of
     * ```
     * {
     *     identifier: {
     *         name: "color",
     *         isNegated: false
     *     },
     *     value: "blue"
     * }
     * ```
     */
    function parseCriterionDefinition(criterionString) {
        const delimiterIndex = criterionString.indexOf("-");
        if (delimiterIndex < 1 || delimiterIndex >= criterionString.length - 1) {
            // this is not a valid criteria definition, the delimiter must exist and cannot be at either end of the string
            return null;
        }

        const value = criterionString.substring(delimiterIndex + 1);

         /*
         * Determine if criterion has a "not" condition. For example:
         *
         * Not negated:
         * 'color-blue': {
         *     ...
         * }
         *
         * Negated:
         * '!color-blue': {
         *     ...
         * }
         */
         const identifier = criterionString.startsWith("!") ?
            {_type: "CriterionIdentifier", name: criterionString.substring(1, delimiterIndex), isNegated: true} :
            {_type: "CriterionIdentifier", name: criterionString.substring(0, delimiterIndex), isNegated: false};
        return {
            _type: "CriterionDefinition",
            identifier,
            value
        };
    }

    /**
     * A MatchableProperty represents a list of values that should be applied if a list of criteria are passed. For
     * example:
     *
     * ```
     * 'family-brass': {
     *     'size-large': {
     *         instrument: "tuba"
     *     }
     * }
     * ```

     *
     * The resulting MatchableProperty would be:
     * ```
     * {
     *     criteria: [
     *         {
     *             identifier: {
     *                 name: "family",
     *                 isNegated: false
     *             },
     *             values: ["brass"]
     *         },
     *         {
     *             identifier: {
     *                 name: "size",
     *                 isNegated: false
     *             },
     *             values: ["large"]
     *         }
     *     ],
     *     values: {
     *         instrument: "tuba"
     *     }
     * }
     * ```
     *
     * As the Ion config is parsed, these properties are assembled into a list ordered from least to most important.
     * Then when values are queried, this list is iterated over and values are added as they match the criteria,
     * overwriting old values with more important ones.
     */
    function newMatchableProperty(criteria, values) {
        return {
            _type: "MatchableProperty",
            criteria,
            values
        };
    }

    function newDynamicIonStruct(matchableProperties) {
        return {
            _type: "DynamicIonStruct", // poor-man's type system
            _isIonProperty: true,
            matchableProperties,
            getIonValues: function(condition) {
                return getIonValuesFromIonProperty(this, condition);
            },
            getIonValue: function(condition) {
                // cascade matchable properties into a set of keys and ion values
                // create a new ion struct and add all the ion values into it, creating a final resulting ion struct
                const aggregatedValues = cascadeMatchableProperties(matchableProperties, condition);
                const result = newIonStruct();
                Object.entries(aggregatedValues).forEach(([fieldName, property]) => {
                    // convert to string and back to a fresh ion object to ensure there's no shared reference back to the config when returning this result
                    // TODO revisit this if its a performance problem, but we do a similar `clone` operation in java here
                    result[fieldName] = clone(property.getIonValue(condition));
                });
                return result;
            },
            isListBased: function() {
                return false;
            }
        };
    }

    function newDynamicIonList(properties) {
        return {
            _type: "DynamicIonList",
            _isIonProperty: true,
            properties,
            getIonValues: function(condition) {
                return getIonValuesFromIonProperty(this, condition);
            },
            getIonValue: function(condition) {
                const ionList = newIonList();
                properties.flatMap(property => property.getIonValues(condition))
                    .map(ionValue => clone(ionValue))
                    .forEach(ionValue => ionList.push(ionValue));
                return ionList;
            },
            isListBased: function() {
                return true;
            }
        };
    }

    function newDynamicIonSubField(subFieldProperties) {
        return {
            _type: "DynamicIonSubField",
            _isIonProperty: true,
            subFieldProperties,
            getIonValue: function() {
                 // Technically, a sub field of a list could be a list but this would be invalid with the config specification and we do not support it.
                throw `getIonValue is not supported for ${this._type}`;
            },
            /**
             * A List's sub field will either be a single field called "value" or a list called "values". We stream them so
             * that they are inlined into the parent list.
             */
            getIonValues: function(condition) {
                /*
                If subFieldProperties has more than one element, it means that there was a list element conditioned by an OR

                Example:
                [
                  'field1-true'::
                  'field2-true'::{
                    value: 1
                  }
                ]

                when parsed this produces multiple matchable properties but all of them will have the same value. We don't want to
                use them all and return a stream of them all, otherwise there'd be a duplicate for every OR condition that passed.
                Instead, we should just sequentially test them all and use the first one that passes since they'll all be equivalent
                and the user only wants the value once.
                 */
                const matchedProperty = subFieldProperties.find(property =>
                    property.criteria.every(criteriaDefinition => criteriaDefinition.testCondition(condition)));

                if (!matchedProperty) {
                    return [];
                }

                const entry = Object.entries(matchedProperty.values)[0];

                // return "value"
                if (SUB_FIELD_VALUE_KEYWORD === entry[0]) {
                    return [entry[1].getIonValue(condition)].filter(Boolean);
                }

                // return "values"
                return [...entry[1].getIonValue(condition)].filter(Boolean); // this should be an IonList, convert it to an array
            },
            isListBased: function() {
                 // Technically, a sub field of a list could be a list but this would be invalid with the config specification and we do not support it.
                 throw `getIonValue is not supported for ${this._type}`;
            }
        };
    }

    function newBasicIonProperty(ionValue) {
        return {
            _type: "BasicIonProperty",
            _isIonProperty: true,
            ionValue,
            getIonValues: function(condition) {
                return getIonValuesFromIonProperty(this, condition);
            },
            getIonValue: function() {
                return ionValue;
            },
            isListBased: function() {
                return isIonList(ionValue);
            }
        };
    }

    /**
     * Represents an OR'd grouping of criteria. For example:
     *
     * ```
     *  'color-blue': 'color-red'::{
     *      ...
     *  }
     * ```
     *
     * Would have a GroupedCriteriaDefinition of
     * ```
     * {
     *     identifier: {
     *         name: "color",
     *         isNegated: false
     *     },
     *     values: ["blue", "red"]
     * }
     * ```
     */
    function newGroupedCriteriaDefinition(identifier, values) {
        return {
            _type: "GroupedCriteriaDefinition",
            identifier,
            values,
            name: identifier.name,
            testCondition: function(inputCondition) {
                const groupedCriteria = {key: identifier.name, values: new Set(values)};
                const condition = identifier.isNegated ? (x) => !inputCondition(x) : inputCondition;
                return condition(groupedCriteria);
            }
        };
    }

    function getIonValuesFromIonProperty(ionProperty, condition) {
        if (!ionProperty._isIonProperty) {
            throw `Input object is not an IonProperty. ${JSON.stringify(ionProperty)}`;
        }
        return [ionProperty.getIonValue(condition)].filter(Boolean);
    }

    function createTypeString(ionValue) {
        return ionValue.isNull() ? "null" : ionValue.getType().name;
    }
    
    function verify(condition, name, errorMessage) {
        if(!condition) {
            throw `Record: ${name}, Error: ${errorMessage}`;
        }
    }

    function verifyNamespaceDeclaration(condition, name, ionValue) {
        verify(condition, name, `A namespace declaration is incorrect. Syntax should be ` +
            `'namespace'::'YourNamespace'::{prioritizedCriteria:[/*Define your priorities as a list of symbols or strings.*/]} but was ${ION.dumpText(ionValue)}`);
    }
}

/**
 * Makes a deep clone of the passed IonValue by serializing it then deserializing it back to Ion. Probably not performant.
 */
function clone(ionValue) {
    return ION.load(ION.dumpText(ionValue));
}

function newIonStruct() {
    return ION.load("{}");
}

function newIonList() {
    return ION.load("[]");
}

function isIonText(ionValue) {
    return isNonNullIon(ionValue) && ["string", "symbol"].includes(ionValue.getType().name);
}

function isIonStruct(ionValue) {
    return isNonNullIon(ionValue) && ionValue.getType().name === "struct";
}

function isIonList(ionValue) {
    return isNonNullIon(ionValue) && ionValue.getType().name === "list";
}

/**
 * Returns true if the IonValue is an IonStruct or IonList.
 */
function couldBeDynamic(ionValue) {
    return isNonNullIon(ionValue) && ["struct", "list"].includes(ionValue.getType().name);
}

function isNonNullIon(ionValue) {
    return !!ionValue && !!ionValue.isNull && !ionValue.isNull();
}
