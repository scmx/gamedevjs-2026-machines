# scripts/render-index.sh embeds import map in index.html (?v=mtime per JS).
.PHONY: build clean index html

DIST_ZIP := dist.zip
KENNEY_ZIP := kenney.zip
KENNEY_FILES := $(shell git ls-files -- 'kenney-new-platformer-pack/Sprites/*/Default/*.png')
GAME_FILES := index.html game.css zzfx.js site.webmanifest $(wildcard game-*.js) $(wildcard editor-*.js) terrain-biome.js

index html: index.html

index.html: scripts/render-index.sh $(wildcard *.js)
	sh scripts/render-index.sh

build: $(DIST_ZIP)
	wc -c < $(DIST_ZIP) | awk '{printf "%.2f KB\n", $$1 / 1000}'

clean:
	rm -f $(DIST_ZIP) $(KENNEY_ZIP)

$(KENNEY_ZIP): $(KENNEY_FILES)
	rm -f $(KENNEY_ZIP)
	zip -rq $(KENNEY_ZIP) $(KENNEY_FILES)

$(DIST_ZIP): $(KENNEY_ZIP) $(GAME_FILES)
	rm -f $(DIST_ZIP)
	cp $(KENNEY_ZIP) $(DIST_ZIP)
	zip $(DIST_ZIP) $(GAME_FILES)
