import {IonConfigManager} from '../src/index.js';
import * as ION from "ion-js";

const INPUT_ION = `
Namespace::Example2::{
    prioritizedCriteria: [
        criteria1,
        criteria2,
        criteria3
    ]
}
Example2::{
    // verify different criteria OR'd together works normally
    myField2:1,
    'criteria1-true':
    'criteria2-true'::
    'criteria3-true'::{
        myField2: 2
    },

    // verify different criteria OR'd together works in a list
    listExample:[
      'criteria1-true'::
      'criteria2-true'::
      'criteria3-true'::{
          value: 3
      }
    ]
}`;

const ionConfigManager = IonConfigManager.fromString("example-1", INPUT_ION);

test('Example2 test', () => {
    [
        [{}, {myField2: ION.load(`1`), listExample: ION.load(`[]`)}],
        [{criteria1: "true"}, {myField2: ION.load(`2`), listExample: ION.load(`[3]`)}],
        [{criteria2: "true"}, {myField2: ION.load(`2`), listExample: ION.load(`[3]`)}],
        [{criteria3: "true"}, {myField2: ION.load(`2`), listExample: ION.load(`[3]`)}],
        [{criteria1: "false", criteria2: "false", criteria3: "false"}, {myField2: ION.load(`1`), listExample: ION.load(`[]`)}],
        [{criteria1: "true", criteria2: "true", criteria3: "true"}, {myField2: ION.load(`2`), listExample: ION.load(`[3]`)}],
        [{criteria1: "true", criteria2: "false", criteria3: "false"}, {myField2: ION.load(`2`), listExample: ION.load(`[3]`)}],
        [{criteria1: "false", criteria2: "true", criteria3: "false"}, {myField2: ION.load(`2`), listExample: ION.load(`[3]`)}],
        [{criteria1: "false", criteria2: "false", criteria3: "true"}, {myField2: ION.load(`2`), listExample: ION.load(`[3]`)}],
    ].forEach(([input, expected]) => {
        const out = ionConfigManager.getValuesForProperties("Example2", input);
        expect(JSON.stringify(out)).toBe(JSON.stringify(expected));
    });
    

});
