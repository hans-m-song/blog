clean:
	rm -rf ./public

build:
	hugo --gc --minify
