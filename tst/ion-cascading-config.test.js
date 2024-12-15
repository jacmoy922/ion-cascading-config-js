import {IonConfigManager, CriteriaPredicate, NamespacedIonConfigManager} from '../src/ion-cascading-config.js';
import * as ION from "ion-js";

const INPUT_ION = `
Namespace::Products::{
    prioritizedCriteria:[
        websiteFeatureGroup,
        department,
        category,
        subcategory,
        sku
    ]
}

Products::{
    layout: [
        brand,
        title,
        customerReviews,
        {
            name: "price",
            template: "common",
            'websiteFeatureGroup-wireless': {
                template: "wireless" // override the standard template for wireless
            },
            modules: [
                "businessPricing",
                "rebates",
                "quantityPrice",
                "points",
                'department-111'::{
                    value: "globalStoreId"
                },
                'department-222'::{
                    value: "priceTax"
                },
                'department-333'::{
                    value: "promoMessaging"
                },
                'category-444'::'category-555'::{
                    'websiteFeatureGroup-wireless': {
                        values: [
                            {
                                name: "promoMessaging",
                                template: "common",
                                'subcategory-1234': {
                                    template: "customTemplate1"
                                },
                                'subcategory-2345': {
                                    template: "customTemplate2"
                                }
                            },
                            "samplingBuyBox"
                        ]
                    }
                }
            ]
        }
    ]
}`;



test('Documentation example with no specified criteria, using the IonConfigManager', () => {
    const ionConfigManager = IonConfigManager.fromString("example-1", INPUT_ION);
    const out = ionConfigManager.getValuesForPredicates("Products", {});

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        layout: ION.load(`[
            brand,
            title,
            customerReviews,
            {
                name: "price",
                template: "common",
                modules: [
                    "businessPricing",
                    "rebates",
                    "quantityPrice",
                    "points"
                ]
            }
        ]`)
    }));
});

test('Documentation example with some specified criteria, using the IonConfigManager', () => {
    const ionConfigManager = IonConfigManager.fromString("example-1", INPUT_ION);
    const out = ionConfigManager.getValuesForPredicates("Products", {
        websiteFeatureGroup: CriteriaPredicate.fromValue("wireless"),
        department: CriteriaPredicate.fromValue("111"),
        category: CriteriaPredicate.fromValue("555"),
        subcategory: CriteriaPredicate.fromValue("1234"),
    });

    expect(JSON.stringify(out)).toBe(JSON.stringify({
        layout: ION.load(`[
            brand,
            title,
            customerReviews,
            {
                name: "price",
                template: "wireless",
                modules: [
                    "businessPricing",
                    "rebates",
                    "quantityPrice",
                    "points",
                    "globalStoreId",
                    {
                        name: "promoMessaging",
                        template: "customTemplate1"
                    },
                    "samplingBuyBox"
                ]
            }
        ]`)
    }));
});

test('Documentation example with no specified criteria, using the NamespacedIonConfigManager', () => {
    const namespacedIonConfigManager = NamespacedIonConfigManager.create({
        namespace:"Products",
        configManager: IonConfigManager.fromString("example-1", INPUT_ION)
    });
    const out = namespacedIonConfigManager.newQuery().findOrThrow("layout");

    expect(JSON.stringify(out)).toBe(JSON.stringify(ION.load(`[
        brand,
        title,
        customerReviews,
        {
            name: "price",
            template: "common",
            modules: [
                "businessPricing",
                "rebates",
                "quantityPrice",
                "points"
            ]
        }
    ]`)));
});

test('Documentation example with some specified criteria, using the NamespacedIonConfigManager', () => {
    const namespacedIonConfigManager = NamespacedIonConfigManager.create({
        namespace:"Products",
        configManager: IonConfigManager.fromString("example-1", INPUT_ION)
    });
    const out = namespacedIonConfigManager.newQuery()
        .withProperty("websiteFeatureGroup", "wireless")
        .withProperty("department", "111")
        .withProperty("category", "555")
        .withProperty("subcategory", "1234")
        .findOrThrow("layout");

    expect(JSON.stringify(out)).toBe(JSON.stringify(ION.load(`[
        brand,
        title,
        customerReviews,
        {
            name: "price",
            template: "wireless",
            modules: [
                "businessPricing",
                "rebates",
                "quantityPrice",
                "points",
                "globalStoreId",
                {
                    name: "promoMessaging",
                    template: "customTemplate1"
                },
                "samplingBuyBox"
            ]
        }
    ]`)));
});