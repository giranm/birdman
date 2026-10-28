import { createFileRoute } from "@tanstack/react-router";
import { BirdmanApp } from "@/components/birdman-app";

export const Route = createFileRoute("/")({ component: BirdmanApp });
