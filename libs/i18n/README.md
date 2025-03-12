# i18n

libs/
└── i18n/
├── src/
│ ├── i18n.module.ts # i18n module definition
│ ├── i18n.service.ts # Core i18n service for translations
│ ├── i18n.constants.ts # Constants for i18n (e.g., default locale)
│ ├── i18n.interface.ts # Interfaces for i18n (e.g., translation data)
│ ├── i18n.decorator.ts # Custom decorators (e.g., @Translate)
│ ├── i18n.guard.ts # i18n guard (e.g., to set locale)
│ ├── i18n.interceptor.ts # i18n interceptor (e.g., to set locale)
│ ├── dtos/ # Data Transfer Objects (DTOs)
│ │ └── translate.dto.ts # DTO for translation requests (if needed)
│ ├── exceptions/ # Custom exceptions
│ │ └── translation-not-found.exception.ts
│ ├── pipes/ # Custom pipes
│ │ └── language-validation.pipe.ts
│ ├── utils/ # Utility functions
│ │ └── i18n.util.ts # Helper functions for i18n
│ ├── i18n/ # Translation files
│ │ ├── en.json # English translations
│ │ ├── zh.json # Chinese translations
│ │ └── ... # Other language files
│ └── index.ts # Barrel file for easy imports
├── test/ # Test files
│ ├── i18n.service.spec.ts # Unit tests for i18n service
│ └── ... # Other test files
├── tsconfig.lib.json # TypeScript configuration for the library
├── package.json # Library's package.json
└── README.md # Library's README
