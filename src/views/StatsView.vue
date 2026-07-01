<!-- src/views/StatsView.vue -->
<template>
  <div class="stats-container">
    <header class="stats-header">
      <h1>📊 各國統計總表</h1>
      <div class="header-actions">
        <button class="btn-export" @click="exportToExcel">📊 匯出 Excel</button>
        <button class="btn-screen" @click="router.push('/screen')" title="開啟代表端">📺 代表端</button>
        <button class="btn-back" @click="router.push('/')">🔙 返回控制台</button>
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
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConferenceStore } from '../stores/conference'

const router = useRouter()
const store = useConferenceStore()

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
.stats-container { padding: 20px; padding-bottom: 50px; background: #f4f6f9; min-height: 100vh; font-family: sans-serif; }
.stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h1 { margin: 0; font-size: 1.8rem; color: #2c3e50; }
.header-actions { display: flex; gap: 10px; }
.btn-screen { background: #2196f3; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-back { background: #607d8b; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-export { background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.table-wrapper { overflow-x: auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.stats-table { width: 100%; border-collapse: collapse; min-width: 1100px; }
.stats-table th, .stats-table td { padding: 12px 10px; text-align: left; border-bottom: 1px solid #eee; }
.stats-table th { background: #f5f5f5; font-weight: 600; position: sticky; top: 0; font-size: 0.9rem; }
.country-col { min-width: 120px; }
.country-name { font-weight: 600; white-space: nowrap; }
.center { text-align: center; }
.total-col { background: #e3f2fd; font-weight: bold; }
.total { font-weight: bold; background: #e3f2fd; }
.passed-col { background: #e8f5e9; font-weight: bold; }
.passed { font-weight: bold; background: #e8f5e9; color: #2e7d32; }
</style>