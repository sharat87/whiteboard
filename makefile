serve:
	npx parcel serve --port 3060 --no-autoinstall --dist-dir public_serve index.html

build:
	npx parcel build --no-cache --no-source-maps --dist-dir public_dist index.html

lint:
	npx tsc --noEmit --project . && npx eslint --report-unused-disable-directives main.ts

deploy: build
	npx gh-pages --dist public_dist

.PHONY: serve build
