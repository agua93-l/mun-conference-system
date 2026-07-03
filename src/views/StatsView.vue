<!-- src/views/StatsView.vue -->
<template>
  <div class="stats-container">
    <header class="stats-header">
      <h1>各國統計總表</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="exportToExcel">📊 匯出 Excel</button>
        <button class="btn btn-secondary" @click="router.push('/screen/' + confId)" title="開啟代表端">📺 代表端</button>
        <button class="btn btn-secondary" @click="router.push('/chair/' + confId)">🔙 返回控制台</button>
      </div>
    </header>
    
    <div class="table-wrapper">
      <table class="stats-table">
        <thead>
          <tr>
            <th class="country-col">國家</th>
            <th>發言次數</th>
            <th>自由磋商</th>
            <th>全體諮詢</th>
            <th>有主持核心磋商</th>
            <th>暫停會議</th>
            <th>恢復會議</th>
            <th>介紹決議草案</th>
            <th>介紹修正案</th>
            <th>P5閉門協商</th>
            <th>唱名表決</th>
            <th>共識決</th>
            <th class="total-col">總動議數</th>
            <th class="passed-col">動議成功次數</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(val, key) in sortedStats" :key="key">
            <td class="country-name">{{ key }}</td>
            <td class="center">{{ val.speeches }}</td>
            <td class="center">{{ val.motions['自由磋商'] || 0 }}</td>
            <td class="center">{{ val.motions['全體諮詢'] || 0 }}</td>
            <td class="center">{{ val.motions['有主持核心磋商'] || 0 }}</td>
            <td class="center">{{ val.motions['暫停會議'] || 0 }}</td>
            <td class="center">{{ val.motions['恢復會議'] || 0 }}</td>
            <td class="center">{{ val.motions['介紹決議草案'] || 0 }}</td>
            <td class="center">{{ val.motions['介紹修正案'] || 0 }}</td>
            <td class="center">{{ val.motions['P5閉門協商'] || 0 }}</td>
            <td class="center">{{ val.motions['唱名表決'] || 0 }}</td>
            <td class="center">{{ val.motions['共識決'] || 0 }}</td>
            <td class="center total">{{ totalMotions(val.motions) }}</td>
            <td class="center passed">{{ val.motionsPassed || 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConferenceStore } from '../stores/conference'

const route = useRoute()
const router = useRouter()
const store = useConferenceStore()
const confId = route.params.id

onMounted(() => { store.loadConference(confId) })

const sortedStats = computed(() => {
  const entries = Object.entries(store.stats)
  entries.sort((a, b) => b[1].speeches - a[1].speeches)
  return Object.fromEntries(entries)
})

const totalMotions = (motions) => {
  return Object.values(motions).reduce((sum, count) => sum + (count || 0), 0)
}

const motionCols = ['自由磋商','全體諮詢','有主持核心磋商','暫停會議','恢復會議','介紹決議草案','介紹修正案','P5閉門協商','唱名表決','共識決']

function exportToExcel() {
  const headers = ['國家', '發言次數', ...motionCols, '總動議數', '動議成功次數']
  const rows = Object.entries(sortedStats.value).map(([country, val]) => [
    country, val.speeches, ...motionCols.map(m => val.motions[m] || 0), totalMotions(val.motions), val.motionsPassed || 0
  ])
  const csv = [headers, ...rows].map(row => row.join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `安理會統計_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.stats-container { padding: 32px 24px 50px; min-height: 100vh; }
.stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h1 { font-size: 1.5rem; }
.header-actions { display: flex; gap: 8px; }
.table-wrapper { overflow-x: auto; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.stats-table { width: 100%; border-collapse: collapse; min-width: 1100px; }
.stats-table th, .stats-table td { padding: 12px 10px; text-align: left; border-bottom: 1px solid var(--color-border); }
.stats-table th { background: var(--color-bg); font-weight: 600; position: sticky; top: 0; font-size: 0.85rem; color: var(--color-text-secondary); }
.country-col { min-width: 120px; }
.country-name { font-weight: 600; white-space: nowrap; }
.center { text-align: center; }
.total-col { background: var(--color-accent-soft); font-weight: 700; }
.total { font-weight: 700; background: var(--color-accent-soft); }
.passed-col { background: var(--color-success-soft); font-weight: 700; }
.passed { font-weight: 700; background: var(--color-success-soft); color: var(--color-success); }
</style>