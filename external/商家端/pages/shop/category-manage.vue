<template>
  <view class="page">
    <view class="toolbar">
      <text class="hint">当前店铺的商品分类，可与后台「Merchant / Category」表对应</text>
      <button class="btn-add" type="default" @click="openDialog('add')">＋ 新增分类</button>
    </view>

    <view v-if="list.length" class="list">
      <view v-for="item in list" :key="item.id" class="row">
        <view class="row-main">
          <text class="name">{{ item.name }}</text>
          <text class="id">#{{ item.id }}</text>
        </view>
        <view class="row-actions">
          <text class="link" @click="openDialog('edit', item)">编辑</text>
          <text class="link danger" @click="confirmDelete(item)">删除</text>
        </view>
      </view>
    </view>

    <view v-else class="empty">
      <text class="empty-icon">📂</text>
      <text class="empty-text">暂无分类，请先新增</text>
    </view>

    <view v-if="dialogVisible" class="mask" @click.self="closeDialog">
      <view class="dialog" @click.stop>
        <text class="dlg-title">{{ dialogMode === 'add' ? '新增分类' : '编辑分类' }}</text>
        <input
          class="dlg-input"
          v-model="dialogName"
          placeholder="分类名称"
          placeholder-class="ph"
        />
        <view class="dlg-btns">
          <button class="dlg-btn ghost" type="default" @click="closeDialog">取消</button>
          <button class="dlg-btn primary" type="default" @click="submitDialog">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import request from '@/utils/request.js'

export default {
  data() {
    return {
      list: [],
      dialogVisible: false,
      dialogMode: 'add',
      dialogName: '',
      editingId: null
    }
  },
  onLoad() {
    this.loadList()
  },
  async onPullDownRefresh() {
    try {
      await this.loadList()
    } catch (e) {
      console.error(e)
    } finally {
      uni.stopPullDownRefresh()
    }
  },
  methods: {
    normalizeList(res) {
      const arr =
        (res && res.data && Array.isArray(res.data.data) && res.data.data) ||
        (res && Array.isArray(res.data) && res.data) ||
        (res && Array.isArray(res) && res) ||
        []
      return arr.map((c) => ({
        id: c.id,
        name: c.name != null ? String(c.name) : ''
      }))
    },
    async loadList() {
      try {
        const res = await request({ url: '/merchant/my-categories', method: 'GET' })
        this.list = this.normalizeList(res)
      } catch (e) {
        this.list = []
        console.log('分类列表加载失败', e)
      }
    },
    openDialog(mode, item) {
      this.dialogMode = mode
      this.dialogVisible = true
      if (mode === 'edit' && item) {
        this.editingId = item.id
        this.dialogName = item.name
      } else {
        this.editingId = null
        this.dialogName = ''
      }
    },
    closeDialog() {
      this.dialogVisible = false
      this.dialogName = ''
      this.editingId = null
    },
    async submitDialog() {
      const name = (this.dialogName || '').trim()
      if (!name) {
        uni.showToast({ title: '请输入分类名称', icon: 'none' })
        return
      }
      try {
        if (this.dialogMode === 'add') {
          await request({
            url: '/merchant/category',
            method: 'POST',
            data: { name, sort: 1 }
          })
          uni.showToast({ title: '已新增', icon: 'success' })
        } else {
          await request({
            url: '/merchant/category/' + this.editingId,
            method: 'PUT',
            data: { name }
          })
          uni.showToast({ title: '已保存', icon: 'success' })
        }
        this.closeDialog()
        await this.loadList()
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    confirmDelete(item) {
      uni.showModal({
        title: '删除分类',
        content: `确定删除「${item.name}」吗？`,
        success: async (res) => {
          if (!res.confirm) return
          try {
            await request({ url: '/merchant/category/' + item.id, method: 'DELETE' })
            uni.showToast({ title: '已删除', icon: 'success' })
            await this.loadList()
          } catch (e) {
            uni.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}
.toolbar {
  background: #fff;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.hint {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-bottom: 20rpx;
  line-height: 1.5;
}
.btn-add {
  background: linear-gradient(135deg, #ff6b35, #ff8c42);
  color: #fff;
  border: none;
  border-radius: 40rpx;
  font-size: 28rpx;
}
.list {
  margin: 0 20rpx;
}
.row {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.row-main {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 30rpx;
  color: #333;
  font-weight: 600;
}
.id {
  font-size: 22rpx;
  color: #bbb;
  margin-top: 8rpx;
  display: block;
}
.row-actions {
  display: flex;
  gap: 24rpx;
}
.link {
  font-size: 26rpx;
  color: #1890ff;
}
.link.danger {
  color: #ff4d4f;
}
.empty {
  padding: 120rpx 40rpx;
  text-align: center;
}
.empty-icon {
  font-size: 80rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-top: 16rpx;
  display: block;
}
.mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}
.dialog {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 36rpx;
}
.dlg-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 24rpx;
}
.dlg-input {
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  margin-bottom: 32rpx;
}
.ph {
  color: #ccc;
}
.dlg-btns {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
}
.dlg-btn {
  flex: 1;
  font-size: 28rpx;
  border-radius: 12rpx;
}
.dlg-btn.ghost {
  background: #f5f5f5;
  color: #666;
}
.dlg-btn.primary {
  background: #ff6b35;
  color: #fff;
}
</style>
