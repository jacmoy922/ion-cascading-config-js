import {IonConfigManager, CriteriaPredicate, NamespacedIonConfigManager} from '../src/ion-cascading-config.js';
import * as ION from "ion-js";

const INPUT_ION = `
Namespace::NamespacedIonConfigManagerTest::{
    prioritizedCriteria : [
        realm,
        domain
    ]
}
NamespacedIonConfigManagerTest::{
    // setup some global values which we will override later
    stringToFind : "Global Default String",
    symbolToFindAsString : 'Global Default Symbol',
    intToFind : 12345,
    doubleToFind : 45.67,
    dateToFind : 2018-01-02T01:23:45.678Z,
    booleanToFind : true,
    classToFind : {
        name : "Alice",
        age : 99
    },
    listToFind : [
        "String 1",
        "String 2",
        "String 3",
        "String 4",
        "String 5"
    ],
    mapToFind : {
        field1 : 1,
        field2 : 2,
        field3 : 3,
        field4 : 4,
        field5 : 5,
    },
    deepMapToFind : {
        field1 : {
            subField : [
                1234,
                5678
            ]
        }
    },
    // test has each value overriden
    'domain-test' : {
        stringToFind : "Global Default String Test",
        symbolToFindAsString : 'Global Default Symbol Test',
        intToFind : 123456,
        doubleToFind : 45.678,
        dateToFind : 2018-01-02T01:23:45.679Z,
        classToFind : {
            name : "Alice Test",
            age : 999
        },
        listToFind : [
            "String 1",
            "String 2",
            "String 3",
            "String 4",
            "String 5",
            "String 6",
        ],
        mapToFind : {
            field1 : 1,
            field2 : 2,
            field3 : 3,
            field4 : 4,
            field5 : 5,
            field6 : 6,
        },
        deepMapToFind : {
            field1 : {
                subField : [
                    1234,
                    5679
                ]
            }
        },
        // override for test + USAmazon
        'realm-USAmazon' : {
            listToFind : [
            ],
            booleanToFind : false
        }
    },
    'realm-USAmazon' : {
        listToFind : [
            "Contains 1 value"
        ],
        booleanToFind : null
    }
}
`;

const ION_CONFIG_MANAGER = IonConfigManager.fromString("example-1", INPUT_ION);

test('NamespacedIonConfigManager global behavior', () => {
    const configManager = NamespacedIonConfigManager.create({
        namespace: "NamespacedIonConfigManagerTest",
        configManager: ION_CONFIG_MANAGER
    });

    expect(configManager.newQuery().findOrThrow("stringToFind")).toBe("Global Default String");
    expect(configManager.newQuery().findOrNull("symbolToFindAsString")).toBe("Global Default Symbol");
    expect(configManager.newQuery().findOrNull("intToFind")).toBe(12345);
    expect(configManager.newQuery().findOrNull("doubleToFind")).toBeCloseTo(45.67);
    expect(configManager.newQuery().findOrNull("dateToFind")).toBe("2018-01-02T01:23:45.678Z");
    expect(configManager.newQuery().findOrNull("booleanToFind")).toBe(true);
    expect(configManager.newQuery().findOrNull("myKey")).toBe(null);
    expect(() => configManager.newQuery().findOrThrow("myKey")).toThrow();
});

test('NamespacedIonConfigManager devo behavior', () => {
    const configManager = NamespacedIonConfigManager.create({
        namespace: "NamespacedIonConfigManagerTest",
        configManager: ION_CONFIG_MANAGER,
        defaultProperties: {
            domain: "test"
        }
    });

    expect(configManager.newQuery().findOrThrow("stringToFind")).toBe("Global Default String Test");
    expect(configManager.newQuery().findOrNull("symbolToFindAsString")).toBe("Global Default Symbol Test");
    expect(configManager.newQuery().findOrNull("intToFind")).toBe(123456);
    expect(configManager.newQuery().findOrNull("doubleToFind")).toBeCloseTo(45.678);
    expect(configManager.newQuery().findOrNull("dateToFind")).toBe("2018-01-02T01:23:45.679Z");
    expect(configManager.newQuery().findOrNull("booleanToFind")).toBe(true);
    expect(configManager.newQuery().findOrNull("myKey")).toBe(null);
    expect(() => configManager.newQuery().findOrThrow("myKey")).toThrow();
});

test('NamespacedIonConfigManager devo behavior using query properties', () => {
    const configManager = NamespacedIonConfigManager.create({
        namespace: "NamespacedIonConfigManagerTest",
        configManager: ION_CONFIG_MANAGER
    });

    expect(configManager.newQuery().withProperties({domain: "test"}).findOrThrow("stringToFind")).toBe("Global Default String Test");
    expect(configManager.newQuery().withProperty("domain", "test").findOrNull("symbolToFindAsString")).toBe("Global Default Symbol Test");
    expect(configManager.newQuery().withPredicates({domain: CriteriaPredicate.fromValue("test")}).findOrNull("intToFind")).toBe(123456);
    expect(configManager.newQuery().withPredicate("domain", CriteriaPredicate.fromValue("test")).findOrNull("doubleToFind")).toBeCloseTo(45.678);
    expect(configManager.newQuery().withProperty("domain", "test").findOrNull("dateToFind")).toBe("2018-01-02T01:23:45.679Z");
    expect(configManager.newQuery().withProperty("domain", "test").findOrNull("booleanToFind")).toBe(true);
    expect(configManager.newQuery().withProperty("domain", "test").findOrNull("myKey")).toBe(null);
    expect(() => configManager.newQuery().withProperty("domain", "test").findOrThrow("myKey")).toThrow();
});
