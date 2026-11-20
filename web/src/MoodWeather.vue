<script setup vapor>
import { computed } from "vue";
import { MOOD_WEATHERS } from "../../shared/mood-weather";
const props = defineProps({ weather: String });
const info = computed(() => MOOD_WEATHERS[props.weather]);
</script>
<template>
  <span v-if="info" :class="['mood-weather', 'is-' + weather]" :title="info.label" :aria-label="info.label" role="img">
    <svg v-if="weather === 'sparkle_sun'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.6" fill="currentColor" />
      <path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M5.1 5.1l1.7 1.7M17.2 17.2l1.7 1.7M18.9 5.1l-1.7 1.7M6.8 17.2l-1.7 1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <svg v-else-if="weather === 'sun'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" opacity="0.22" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
    </svg>
    <svg v-else-if="weather === 'partly_cloudy'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9.2" cy="9.2" r="3.4" class="mw-sun" fill="currentColor" />
      <path d="M9.2 3.2v1.4M3.2 9.2h1.4M5 5l1 1M13.4 5l-1 1" class="mw-sun" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      <path d="M8.5 18.5h8.7a3.3 3.3 0 0 0 .4-6.56 4.6 4.6 0 0 0-8.9-1.14A3.4 3.4 0 0 0 8.5 18.5Z" fill="var(--surface)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </svg>
    <svg v-else-if="weather === 'breeze'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 9.5h11.2a2.3 2.3 0 1 0-2.1-3.2M3.5 13.5h14.4a2.3 2.3 0 1 1-2.1 3.2M5.5 17.5h6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <svg v-else-if="weather === 'cloudy'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 18h10.2a3.6 3.6 0 0 0 .45-7.17 5.2 5.2 0 0 0-10.05-1.28A3.8 3.8 0 0 0 7.2 18Z" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </svg>
    <svg v-else-if="weather === 'drizzle'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 14.8h10a3.3 3.3 0 0 0 .4-6.57 4.7 4.7 0 0 0-9.1-1.16A3.4 3.4 0 0 0 7.2 14.8Z" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
      <path d="M9.5 17.8l-.8 2.1M14.5 17.8l-.8 2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
    <svg v-else-if="weather === 'rain'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 14.4h10.2a3.3 3.3 0 0 0 .4-6.57 4.7 4.7 0 0 0-9.1-1.16A3.4 3.4 0 0 0 7 14.4Z" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
      <path d="M8.5 17.2l-1.2 3M12.5 17.2l-1.2 3M16.5 17.2l-1.2 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
    <svg v-else-if="weather === 'thunder'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 14h10.2a3.2 3.2 0 0 0 .4-6.37 4.6 4.6 0 0 0-8.9-1.13A3.3 3.3 0 0 0 7 14Z" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      <path d="M12.8 13.8 10 18h2.6l-1.2 3.5L15.4 16.6h-2.5l1.2-2.8Z" class="mw-bolt" fill="currentColor" />
    </svg>
  </span>
</template>
<style scoped>
.mood-weather {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--surface);
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14);
  line-height: 1;
  user-select: none;
}
.mood-weather svg {
  display: block;
  width: 13px;
  height: 13px;
}
.mood-weather.is-sparkle_sun { color: #f59e0b; background: #fffbeb; }
.mood-weather.is-sun { color: #ea8c00; background: #fffcf0; }
.mood-weather.is-partly_cloudy { color: #64748b; background: #f8fafc; }
.mood-weather.is-partly_cloudy .mw-sun { color: #f59e0b; }
.mood-weather.is-breeze { color: #0ea5a4; background: #f0fdfa; }
.mood-weather.is-cloudy { color: #64748b; background: #f1f5f9; }
.mood-weather.is-drizzle { color: #3b82f6; background: #eff6ff; }
.mood-weather.is-rain { color: #4f46e5; background: #eef2ff; }
.mood-weather.is-thunder { color: #475569; background: #f1f5f9; }
.mood-weather.is-thunder .mw-bolt { color: #f59e0b; }
</style>
