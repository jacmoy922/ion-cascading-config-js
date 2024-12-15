import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        rules: {
            semi: [ "error" ],
            "max-len": [
                "error", {
                  "code": 170,
                  "tabWidth": 4
                }
            ],
            "no-unused-vars": [
                "error",
                {
                    "argsIgnorePattern": "_"
                }
            ]
        }
    }
];