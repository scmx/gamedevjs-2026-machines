.PHONY: build clean

DIST_ZIP := dist.zip
KENNEY_ZIP := kenney.zip
KENNEY_FILES := $(wildcard kenney-new-platformer-pack/Sprites/*/Default/*.png)
GAME_FILES := index.html game.css game-*.js zzfx.js site.webmanifest editor-*.js

build: $(DIST_ZIP)
	wc -c < $(DIST_ZIP) | awk '{printf "%.2f KB\n", $$1 / 1000}'

clean:
	rm -f $(DIST_ZIP) $(KENNEY_ZIP)

$(KENNEY_ZIP): $(KENNEY_FILES)
	zip -r $(KENNEY_ZIP) $(KENNEY_FILES)

$(DIST_ZIP): $(KENNEY_ZIP) $(GAME_FILES)
	cp $(KENNEY_ZIP) $(DIST_ZIP)
	zip $(DIST_ZIP) $(GAME_FILES)
