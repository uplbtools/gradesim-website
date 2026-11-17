import { json } from '@sveltejs/kit';
import { programCourses } from '#lib/curriculum.ts';

export const prerender = true;

export const GET = () => json(programCourses());
