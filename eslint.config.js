import js from "@eslint/js";
import globals from "globals";


export default [
    js.configs.recommended,
    //js.configs.all,
    {
        rules: {
            semi: [ "error" ]
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                "ion": "readonly"
            }
        }


    }
];