import js from "@eslint/js";
import jest from 'eslint-plugin-jest';
import json from "eslint-plugin-json";
import stylisticJs from '@stylistic/eslint-plugin-js';


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
        },
        plugins: {
            jest,
            '@stylistic/js': stylisticJs
        },
        languageOptions: {
            globals: jest.environments.globals.globals,
        }
    },
    {
        files: ["**/*.json"],
        ...json.configs["recommended"]
    }
];