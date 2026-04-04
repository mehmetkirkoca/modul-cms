export COMPOSE_PROJECT_ROOT := $(shell pwd)

PLUGIN_COMPOSE := $(shell find plugins -maxdepth 2 -name "docker-compose.plugin.yml" | sort | sed 's/^/-f /' | tr '\n' ' ')
COMPOSE := docker compose -f docker-compose.yml $(PLUGIN_COMPOSE)

.PHONY: up down logs ps build

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

build:
	$(COMPOSE) --profile container build
