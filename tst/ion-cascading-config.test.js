//require('../ion-bundle.min.js');
//require('../src/ion-cascading-config.js');

import {IonConfigManager} from '../src/ion-cascading-config.js';
import * as ION from "ion-js";

const INPUT = `
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

const EXPECTED = {
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
};

test('one', () => {


    const ionConfigManager = IonConfigManager.fromString("example-1", INPUT);

    const out = ionConfigManager.getValuesForPredicates("Products", {});
    //const out = ION.load("1");
    expect(JSON.stringify(out)).toBe(JSON.stringify(EXPECTED));
});

