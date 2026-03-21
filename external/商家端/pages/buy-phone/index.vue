<template>
  <view class="container">
    <!-- 顶栏：返回 + 标题 -->
    <view class="nav-bar">
      <view class="nav-left" @click="goBack">
        <text class="nav-arrow">‹</text>
      </view>
      <text class="nav-title">我要买二手机</text>
    </view>

    <!-- 筛选栏：品牌型号 -->
    <view class="filter-bar">
      <view class="filter-row">
        <picker mode="selector" :range="brandList" :value="brandIndex" @change="onBrandChange">
          <view class="filter-item">
            <text>{{ brandIndex === 0 ? '品牌型号' : brandList[brandIndex] }}</text>
            <text class="filter-arrow">▼</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- 右侧浮动：卡片/列表切换 -->
    <view class="float-side-btn" @click="onFloatBtn">
      <text class="float-icon">▤</text>
    </view>

    <!-- 商品列表 -->
    <scroll-view class="list-wrap" scroll-y :style="{ height: listHeight + 'px' }" @scrolltolower="loadMore" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
      <view class="list-inner" v-if="list.length > 0">
        <view class="phone-card" v-for="item in list" :key="item.商品ID" :style="{ minHeight: cardMinHeightPx + 'px' }" @click="goDetail(item.商品ID)">
          <!-- 第一行：橙色小方标 + 机型名 -->
          <view class="card-top">
            <view v-if="item.等级" class="card-grade-box">
              <text class="card-grade-text">{{ item.等级 }}</text>
            </view>
            <text class="card-model">{{ item.商品名称 }}</text>
          </view>
          <!-- 第二块：严选联盟 pill + 竖线分隔的灰色标签，可换行 -->
          <view class="card-tags" v-if="item.联盟 || (item.标签列表 && item.标签列表.length)">
            <text v-if="item.联盟" class="card-tag-pill">{{ item.联盟 }}</text>
            <text v-if="item.标签文案" class="card-tag-plain">{{ item.标签文案 }}</text>
          </view>
          <!-- 第三行：价格+起拍 + 定位+托管 + 出价按钮 -->
          <view class="card-bottom">
            <view class="card-left">
              <text class="card-price">¥{{ item.价格 }}</text>
            </view>
            <view class="card-actions">
              <view class="card-consult-btn" @click.stop="onConsult(item)">咨询</view>
              <view class="card-buy-btn" @click.stop="onBuy(item)">直接购买</view>
            </view>
          </view>
        </view>
      </view>
      <view class="empty-wrap" v-else>
        <text class="empty-icon">📱</text>
        <text class="empty-text">暂无在售二手机</text>
        <text class="empty-tip">后期上传商品后将按机型配置价格每行展示</text>
      </view>
    </scroll-view>

  </view>
</template>

<script>
import { getFoodList } from '@/api/food.js'

const CATEGORY_NAME = '二手机'

export default {
  data() {
    return {
      list: [],
      listHeight: 400,
      refreshing: false,
      brandList: ['全部', '华为', '荣耀', 'OPPO', 'VIVO', '苹果iphone', '小米'],
      brandIndex: 0
    }
  },
  computed: {
    cardMinHeightPx() {
      const h = this.listHeight
      const paddingAndGaps = 50
      return Math.max(120, Math.floor((h - paddingAndGaps) / 5))
    }
  },
  onLoad() {
    const sys = uni.getSystemInfoSync()
    const winH = sys.windowHeight || 500
    this.listHeight = Math.max(400, Math.floor(winH - 100))
    this.loadList()
  },
  onPullDownRefresh() {
    this.loadList().then(() => uni.stopPullDownRefresh())
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    onBrandChange(e) {
      this.brandIndex = e.detail.value
      this.loadList()
    },
    onFloatBtn() {
      uni.showToast({ title: '列表/卡片', icon: 'none' })
    },
    async loadList() {
      try {
        const 搜索 = this.brandIndex === 0 ? '' : this.brandList[this.brandIndex]
        const res = await getFoodList(CATEGORY_NAME, undefined, 搜索)
        let rows = res.商品列表 || []
        const 等级List = ['E', 'C+2', 'I+', 'E1', 'C+']
        const 联盟List = ['严选联盟', '个人货源', '严选联盟', '门店直收', '严选联盟']
        const 卖家List = ['严选小豹帮卖', '广东深圳仓', '严选托管-均盛通讯', '江西志远站', '严选托管-均盛通讯']
        const 标签示例 = ['国行', '过保', '壳大花', '屏大花', '屏幕显示异常', '外屏维修', '面容功能异常']
        rows = rows.map((item, i) => {
          const 描述 = (item.描述 || '').trim()
          const 标签数组 = 描述 ? 描述.split(/\|/).map(s => s.trim()).filter(Boolean) : 标签示例
          const 联盟 = 联盟List[i % 5]
          const 标签文案 = 标签数组.join(' | ')
          return {
            ...item,
            等级: 等级List[i % 5] || '',
            联盟: 联盟,
            标签列表: 标签数组,
            标签文案: 标签文案,
            卖家: item.卖家 || 卖家List[i % 5]
          }
        })
        if (rows.length === 0) {
          rows = [
            {
              商品ID: 0,
              商品名称: '苹果 iPhone Xs 256G 银色',
              价格: 390,
              描述: '国行|过保|壳大花|屏大花|屏幕显示异常|外屏维修|面容功能异常',
              等级: 'I+',
              联盟: '严选联盟',
              标签列表: ['国行', '过保', '壳大花', '屏大花', '屏幕显示异常', '外屏维修', '面容功能异常'],
              标签文案: '国行 | 过保 | 壳大花 | 屏大花 | 屏幕显示异常 | 外屏维修 | 面容功能异常',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 1,
              商品名称: 'OPPO A55',
              价格: 350,
              描述: '国行|全网通|成色良好',
              等级: 'E',
              联盟: '严选联盟',
              标签列表: ['国行', '全网通', '成色良好'],
              标签文案: '国行 | 全网通 | 成色良好',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 2,
              商品名称: '小米9',
              价格: 260,
              描述: '国行|全网通|功能正常',
              等级: 'C+',
              联盟: '严选联盟',
              标签列表: ['国行', '全网通', '功能正常'],
              标签文案: '国行 | 全网通 | 功能正常',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 3,
              商品名称: '荣耀9',
              价格: 150,
              描述: '国行|全网通|备用机',
              等级: 'E1',
              联盟: '严选联盟',
              标签列表: ['国行', '全网通', '备用机'],
              标签文案: '国行 | 全网通 | 备用机',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 4,
              商品名称: '华为P30',
              价格: 300,
              描述: '国行|全网通|成色靓',
              等级: 'C+2',
              联盟: '严选联盟',
              标签列表: ['国行', '全网通', '成色靓'],
              标签文案: '国行 | 全网通 | 成色靓',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 5,
              商品名称: 'vivo Y52s 8+128G',
              价格: 420,
              描述: '国行|全网通|功能正常',
              等级: 'E',
              联盟: '严选联盟',
              标签列表: ['国行', '全网通', '功能正常'],
              标签文案: '国行 | 全网通 | 功能正常',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 6,
              商品名称: '红米 Note9 6+128G',
              价格: 380,
              描述: '国行|全网通|成色良好',
              等级: 'C+',
              联盟: '严选联盟',
              标签列表: ['国行', '全网通', '成色良好'],
              标签文案: '国行 | 全网通 | 成色良好',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 7,
              商品名称: '苹果 iPhone 7 128G',
              价格: 480,
              描述: '国行|过保|备用机',
              等级: 'I+',
              联盟: '严选联盟',
              标签列表: ['国行', '过保', '备用机'],
              标签文案: '国行 | 过保 | 备用机',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 8,
              商品名称: '华为 畅享20',
              价格: 320,
              描述: '国行|全网通|功能正常',
              等级: 'E1',
              联盟: '严选联盟',
              标签列表: ['国行', '全网通', '功能正常'],
              标签文案: '国行 | 全网通 | 功能正常',
              卖家: '严选托管-均盛通讯'
            },
            {
              商品ID: 9,
              商品名称: 'OPPO K7x 8+128G',
              价格: 450,
              描述: '国行|全网通|成色靓',
              等级: 'C+2',
              联盟: '严选联盟',
              标签列表: ['国行', '全网通', '成色靓'],
              标签文案: '国行 | 全网通 | 成色靓',
              卖家: '严选托管-均盛通讯'
            }
          ]
        }
        this.list = rows
      } catch (e) {
        this.list = [
          {
            商品ID: 0,
            商品名称: '苹果 iPhone Xs 256G 银色',
            价格: 390,
            描述: '国行|过保|壳大花|屏大花|屏幕显示异常|外屏维修|面容功能异常',
            等级: 'I+',
            联盟: '严选联盟',
            标签列表: ['国行', '过保', '壳大花', '屏大花', '屏幕显示异常', '外屏维修', '面容功能异常'],
            标签文案: '国行 | 过保 | 壳大花 | 屏大花 | 屏幕显示异常 | 外屏维修 | 面容功能异常',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 1,
            商品名称: 'OPPO A55',
            价格: 350,
            描述: '国行|全网通|成色良好',
            等级: 'E',
            联盟: '严选联盟',
            标签列表: ['国行', '全网通', '成色良好'],
            标签文案: '国行 | 全网通 | 成色良好',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 2,
            商品名称: '小米9',
            价格: 260,
            描述: '国行|全网通|功能正常',
            等级: 'C+',
            联盟: '严选联盟',
            标签列表: ['国行', '全网通', '功能正常'],
            标签文案: '国行 | 全网通 | 功能正常',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 3,
            商品名称: '荣耀9',
            价格: 150,
            描述: '国行|全网通|备用机',
            等级: 'E1',
            联盟: '严选联盟',
            标签列表: ['国行', '全网通', '备用机'],
            标签文案: '国行 | 全网通 | 备用机',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 4,
            商品名称: '华为P30',
            价格: 300,
            描述: '国行|全网通|成色靓',
            等级: 'C+2',
            联盟: '严选联盟',
            标签列表: ['国行', '全网通', '成色靓'],
            标签文案: '国行 | 全网通 | 成色靓',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 5,
            商品名称: 'vivo Y52s 8+128G',
            价格: 420,
            描述: '国行|全网通|功能正常',
            等级: 'E',
            联盟: '严选联盟',
            标签列表: ['国行', '全网通', '功能正常'],
            标签文案: '国行 | 全网通 | 功能正常',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 6,
            商品名称: '红米 Note9 6+128G',
            价格: 380,
            描述: '国行|全网通|成色良好',
            等级: 'C+',
            联盟: '严选联盟',
            标签列表: ['国行', '全网通', '成色良好'],
            标签文案: '国行 | 全网通 | 成色良好',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 7,
            商品名称: '苹果 iPhone 7 128G',
            价格: 480,
            描述: '国行|过保|备用机',
            等级: 'I+',
            联盟: '严选联盟',
            标签列表: ['国行', '过保', '备用机'],
            标签文案: '国行 | 过保 | 备用机',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 8,
            商品名称: '华为 畅享20',
            价格: 320,
            描述: '国行|全网通|功能正常',
            等级: 'E1',
            联盟: '严选联盟',
            标签列表: ['国行', '全网通', '功能正常'],
            标签文案: '国行 | 全网通 | 功能正常',
            卖家: '严选托管-均盛通讯'
          },
          {
            商品ID: 9,
            商品名称: 'OPPO K7x 8+128G',
            价格: 450,
            描述: '国行|全网通|成色靓',
            等级: 'C+2',
            联盟: '严选联盟',
            标签列表: ['国行', '全网通', '成色靓'],
            标签文案: '国行 | 全网通 | 成色靓',
            卖家: '严选托管-均盛通讯'
          }
        ]
      }
    },
    onRefresh() {
      this.refreshing = true
      this.loadList().then(() => {
        this.refreshing = false
      })
    },
    loadMore() {},
    goDetail(id) {
      uni.navigateTo({ url: '/pages/food/detail?id=' + id })
    },
    onConsult(item) {
      uni.showToast({ title: '咨询：' + item.商品名称, icon: 'none' })
    },
    onBuy(item) {
      uni.showToast({ title: '直接购买：' + item.商品名称, icon: 'none' })
    }
  }
}
</script>

<style scoped>
.container {
  background: #f2f2f2;
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: 0;
}

.nav-bar {
  padding-top: calc(36rpx + env(safe-area-inset-top));
  padding-bottom: 18rpx;
  padding-left: 24rpx;
  padding-right: 24rpx;
  background: #fff;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  border-bottom: 1rpx solid #eee;
}
.nav-left {
  margin-right: 24rpx;
}
.nav-arrow {
  font-size: 48rpx;
  color: #333;
  font-weight: 300;
}
.nav-title {
  flex: 1;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
}

.filter-bar {
  background: #fff;
  padding: 14rpx 24rpx;
  border-bottom: 1rpx solid #eee;
}
.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16rpx;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 4rpx;
  font-size: 26rpx;
  color: #333;
}
.filter-arrow {
  font-size: 20rpx;
  color: #999;
}
.filter-btn {
  font-size: 26rpx;
  color: #333;
  padding: 8rpx 16rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
}
.float-side-btn {
  position: fixed;
  right: 24rpx;
  top: 320rpx;
  z-index: 10;
  width: 72rpx;
  height: 72rpx;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}
.float-icon {
  font-size: 36rpx;
  color: #333;
}

.list-wrap {
  background: #f2f2f2;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.list-inner {
  padding: 16rpx 24rpx;
  padding-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  box-sizing: border-box;
}
.phone-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 18rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}
.card-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 10rpx;
}
.card-grade-box {
  flex-shrink: 0;
  width: 44rpx;
  height: 44rpx;
  background: #ff9800;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-grade-text {
  font-size: 22rpx;
  font-weight: bold;
  color: #fff;
}
.card-model {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  flex: 1;
}
.card-tags {
  margin-bottom: 12rpx;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx 4rpx;
}
.card-tag-pill {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #1976d2;
  background: #e3f2fd;
  border: 1rpx solid #90caf9;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
}
.card-tag-plain {
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}
.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.card-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6rpx 12rpx;
}
.card-price {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}
.card-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.card-consult-btn {
  padding: 14rpx 24rpx;
  font-size: 26rpx;
  color: #666;
  background: #fff;
  border: 2rpx solid #ddd;
  border-radius: 32rpx;
}
.card-buy-btn {
  padding: 14rpx 24rpx;
  font-size: 26rpx;
  color: #fff;
  background: #ff9800;
  border: 2rpx solid #f57c00;
  border-radius: 32rpx;
}

.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
}
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 30rpx; color: #999; margin-bottom: 12rpx; }
.empty-tip { font-size: 24rpx; color: #ccc; text-align: center; }

</style>
