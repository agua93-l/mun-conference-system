<template>
  <div class="docs-container">
    <div class="docs-inner">
      <header class="docs-header">
        <h1>{{ store.title || '會議' }} 文件庫</h1>
        <p class="docs-subtitle">主席團公告的正式文件；修正案會標示表決結果</p>
      </header>

      <section class="doc-group" v-for="group in groups" :key="group.label">
        <h2>{{ group.icon }} {{ group.label }} <span class="count-badge">{{ group.docs.length }}</span></h2>
        <div v-if="group.docs.length === 0" class="empty">目前沒有{{ group.label }}</div>
        <div v-for="doc in group.docs" :key="doc.id" class="doc-card">
          <div class="doc-card-head">
            <span class="doc-number">[{{ doc.type }} {{ doc.number }}]</span>
            <span class="doc-title">{{ doc.title }}</span>
            <span v-if="doc.type === 'A'" class="badge" :class="doc.voteStatus === 'passed' ? 'badge-success' : doc.voteStatus === 'failed' ? 'badge-danger' : 'badge-neutral'">
              {{ doc.voteStatus === 'passed' ? '✅ 已通過' : doc.voteStatus === 'failed' ? '❌ 未通過' : '⏳ 未表決' }}
            </span>
            <a v-if="doc.fileURL" :href="doc.fileURL" target="_blank" class="btn btn-secondary btn-sm doc-download">📥 下載</a>
          </div>
          <div v-if="doc.type === 'A'" class="amend-detail">
            <div class="amend-meta">
              <span v-if="doc.sponsor" class="badge badge-neutral">提案國：{{ doc.sponsor }}</span>
              <span class="badge badge-accent">{{ docLabel(doc.targetDocId) }}</span>
              <span class="badge badge-neutral">條款 {{ doc.clause }}</span>
              <span class="badge badge-warning">{{ doc.actionType }}</span>
            </div>
            <p class="amend-text">{{ doc.changeText }}</p>
          </div>
        </div>
      </section>

      <p class="docs-footer">本頁面會即時更新，主席公告新文件後會自動出現</p>
    </div>
  </div>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useConferenceStore } from '../stores/conference'

const route = useRoute()
const store = useConferenceStore()

const approved = computed(() => store.documents.filter(d => d.status === 'approved'))
const groups = computed(() => [
  { label: '決議草案', icon: '📜', docs: approved.value.filter(d => d.type === 'DR' && d.stage === 'formal') },
  { label: '潛在決議草案', icon: '📃', docs: approved.value.filter(d => d.type === 'DR' && d.stage !== 'formal') },
  { label: '修正案', icon: '✏️', docs: approved.value.filter(d => d.type === 'A') },
  { label: '工作文件', icon: '📄', docs: approved.value.filter(d => d.type === 'WD') }
])

function docLabel(docId) {
  const d = store.documents.find(x => x.id === docId)
  return d ? `目標：[${d.type} ${d.number}] ${d.title}` : '目標草案未指定'
}

watch(() => store.title, (t) => { document.title = t ? t + ' - 文件庫' : 'MUN 文件庫' })

onMounted(() => { store.loadConference(route.params.id) })
</script>

<style scoped>
.docs-container { min-height: 100vh; padding: 40px 24px 60px; }
.docs-inner { max-width: 760px; margin: 0 auto; }
.docs-header { margin-bottom: 28px; }
.docs-header h1 { font-size: 1.5rem; margin-bottom: 6px; }
.docs-subtitle { color: var(--color-text-secondary); font-size: 0.9rem; margin: 0; }

.doc-group { margin-bottom: 28px; }
.doc-group h2 { font-size: 1.05rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.count-badge { background: #f4f4f5; color: var(--color-text-secondary); font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; }

.doc-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 14px 16px; margin-bottom: 10px; }
.doc-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.doc-number { font-weight: 700; color: var(--color-accent); white-space: nowrap; }
.doc-title { font-weight: 600; flex: 1; min-width: 120px; }
.doc-download { margin-left: auto; text-decoration: none; }

.amend-detail { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--color-border); }
.amend-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.amend-text { margin: 0; font-size: 0.9rem; line-height: 1.6; color: var(--color-text); white-space: pre-wrap; background: var(--color-bg); border-radius: var(--radius-sm); padding: 10px 12px; }

.empty { color: var(--color-text-muted); font-size: 0.88rem; padding: 10px 2px; }
.docs-footer { text-align: center; color: var(--color-text-muted); font-size: 0.8rem; margin-top: 32px; }
</style>
