import {IonConfigManager, CriteriaPredicate} from '../src/index.js';
import * as ION from "ion-js";

const INPUT_ION = `
Skus::{
    field3 : "bar",
    'sku-B0000SKU3':{
        field3: "foo"
    },
    'category-value-has-multiple-hyphens':{
        field3: "fib"
    },
    'category-thisShouldNotAffectAnythingBecauseItIsEmpty':{}
}

Namespace::Skus::{
    prioritizedCriteria: [
        category,
        seller,
        sku,
        featureFlag
    ]
}

Skus::{
    field1: 123,
    'seller-1234': {
        field1: "hello",
        'category-001234321': {
            field1: 35.6
        }
    },
    'category-001234321':
    'category-001237865'::{
        field1: 12,
        'sku-B0000SKU1': {
            field1: {
                subField: 1234,
                'seller-123231': {
                    subStruct: {
                        subSubField: 432432
                    }
                }
            },
            field2: [ 404939 ]
        },
        'sku-B0000SKU2': {
            field1: {
                subField: 1234398
            },
            field2: [
                4049394,
                'seller-123231'::{
                    values: [203897432]
                }
            ],
            'featureFlag-EXAMPLE_12345:T1': {
                field2: [ 12345 ]
            },
            '!featureFlag-EXAMPLE_12345:T1': {
                notConditionedfeatureFlagExample: "Hello!"
            }
        },
        '!sku-B0000SKU3': {
            notExample: "not B0000SKU3"
        }
    },
    'seller-2345': {
        specialField1: "special1"
    },
    'seller-3456': {
        specialField2: "special2"
    }
}
`;

const ionConfigManager = IonConfigManager.fromString("example-1", INPUT_ION);

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {});

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`123`)
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        seller: CriteriaPredicate.fromValue("1234")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`"hello"`)
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        seller: CriteriaPredicate.fromValue("1234"),
        category: CriteriaPredicate.fromValue("001234321"),
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`35.6`),
        notExample: ION.load(`"not B0000SKU3"`),
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001234321")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`12`),
        notExample: ION.load(`"not B0000SKU3"`),
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001237865")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`12`),
        notExample: ION.load(`"not B0000SKU3"`),
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001234321"),
        sku: CriteriaPredicate.fromValue("B0000SKU1")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`{subField:1234}`),
        field2: ION.load(`[404939]`),
        notExample: ION.load(`"not B0000SKU3"`),
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001234321"),
        sku: CriteriaPredicate.fromValue("B0000SKU1"),
        seller: CriteriaPredicate.fromValue("123231")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`{subField:1234,subStruct:{subSubField:432432}}`),
        field2: ION.load(`[404939]`),
        notExample: ION.load(`"not B0000SKU3"`),
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001237865"),
        sku: CriteriaPredicate.fromValue("B0000SKU1")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`{subField:1234}`),
        field2: ION.load(`[404939]`),
        notExample: ION.load(`"not B0000SKU3"`),
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001234321"),
        sku: CriteriaPredicate.fromValue("B0000SKU2")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`{subField:1234398}`),
        field2: ION.load(`[4049394]`),
        notExample: ION.load(`"not B0000SKU3"`),
        notConditionedfeatureFlagExample: ION.load(`"Hello!"`),
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001234321"),
        sku: CriteriaPredicate.fromValue("B0000SKU2"),
        seller: CriteriaPredicate.fromValue("123231")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`{subField:1234398}`),
        field2: ION.load(`[4049394,203897432]`),
        notExample: ION.load(`"not B0000SKU3"`),
        notConditionedfeatureFlagExample: ION.load(`"Hello!"`),
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001237865"),
        sku: CriteriaPredicate.fromValue("B0000SKU3")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"foo"`),
        field1: ION.load(`12`)
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("value-has-multiple-hyphens")
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"fib"`),
        field1: ION.load(`123`)
    }));
});

test('Skus config test', () => {
    const out = ionConfigManager.getValuesForPredicates("Skus", {
        category: CriteriaPredicate.fromValue("001234321"),
        sku: CriteriaPredicate.fromValue("B0000SKU2"),
        featureFlag: CriteriaPredicate.fromCondition((flag) => {
            // check if flag is EXAMPLE_12345:T1 vs EXAMPLE_12345:C vs something else
            const parts = flag.split(":");
            return parts[0] === "EXAMPLE_12345" && parts[1] === "T1";
        })
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        field3: ION.load(`"bar"`),
        field1: ION.load(`{subField:1234398}`),
        field2: ION.load(`[12345]`),
        notExample: ION.load(`"not B0000SKU3"`)
    }));
});
