// pages/map/map.js
const { PROVINCE_MAP, LANDMARK_CITY } = require('../../utils/constants');

// 全国主要城市坐标（GCJ-02，与腾讯地图一致）
const CITY_COORDS = {
  '北京':   { lng: 116.407, lat: 39.904 },
  '上海':   { lng: 121.473, lat: 31.230 },
  '广州':   { lng: 113.264, lat: 23.129 },
  '深圳':   { lng: 114.057, lat: 22.543 },
  '成都':   { lng: 104.066, lat: 30.573 },
  '重庆':   { lng: 106.551, lat: 29.563 },
  '杭州':   { lng: 120.153, lat: 30.287 },
  '南京':   { lng: 118.796, lat: 32.060 },
  '武汉':   { lng: 114.305, lat: 30.593 },
  '西安':   { lng: 108.939, lat: 34.341 },
  '长沙':   { lng: 112.938, lat: 28.228 },
  '厦门':   { lng: 118.089, lat: 24.480 },
  '昆明':   { lng: 102.833, lat: 24.880 },
  '三亚':   { lng: 109.508, lat: 18.252 },
  '拉萨':   { lng: 91.132,  lat: 29.660 },
  '哈尔滨': { lng: 126.535, lat: 45.802 },
  '大连':   { lng: 121.614, lat: 38.914 },
  '青岛':   { lng: 120.382, lat: 36.067 },
  '苏州':   { lng: 120.585, lat: 31.298 },
  '天津':   { lng: 117.201, lat: 39.085 },
  '郑州':   { lng: 113.625, lat: 34.746 },
  '济南':   { lng: 117.000, lat: 36.651 },
  '合肥':   { lng: 117.227, lat: 31.820 },
  '南昌':   { lng: 115.892, lat: 28.676 },
  '福州':   { lng: 119.296, lat: 26.074 },
  '南宁':   { lng: 108.366, lat: 22.817 },
  '桂林':   { lng: 110.267, lat: 25.273 },
  '贵阳':   { lng: 106.713, lat: 26.568 },
  '兰州':   { lng: 103.826, lat: 36.058 },
  '银川':   { lng: 106.230, lat: 38.487 },
  '西宁':   { lng: 101.778, lat: 36.617 },
  '乌鲁木齐':{ lng: 87.616,  lat: 43.820 },
  '呼和浩特':{ lng: 111.751, lat: 40.841 },
  '太原':   { lng: 112.548, lat: 37.870 },
  '沈阳':   { lng: 123.431, lat: 41.805 },
  '长春':   { lng: 125.325, lat: 43.886 },
  '海口':   { lng: 110.331, lat: 20.031 },
  '丽江':   { lng: 100.229, lat: 26.872 },
  '张家界': { lng: 110.479, lat: 29.116 },
  '敦煌':   { lng: 94.662,  lat: 40.142 }
};

function normalizeCity(name) {
  if (!name) return '';
  // 1. 先查景点/地标映射表（西湖→杭州 这类）
  for (let landmark in LANDMARK_CITY) {
    if (name.includes(landmark)) return LANDMARK_CITY[landmark];
  }
  // 2. 再匹配城市名本身
  // 【优化 2026-09-25】去掉 k.includes(name) 的反向匹配：短地名（如"京"、"哈尔"）
  // 会被误匹配到"北京"、"哈尔滨"等，只保留 name.includes(k) 的正向匹配
  for (let k in CITY_COORDS) {
    if (name.includes(k)) return k;
  }
  return name;
}

const CHINA_CENTER = [104.195, 35.86]; // 中国中心

Page({
  data: {
    visitedCities: [],
    mapCenter: CHINA_CENTER,
    mapScale: 4,
    markers: [],
    stats: { cities: 0, provinces: 0, total: 0, provincesList: [] }
  },

  onLoad()  { this.loadData(); },
  onShow()    { this.loadData(); },

  loadData() {
    try {
      const raw = wx.getStorageSync('travel_trips');
      const trips = raw ? JSON.parse(raw) : [];
      const checkedCities = new Set();
      const visitedProvinces = new Set();

      trips.forEach(trip => {
        if (!trip.checked) return;
        const city = normalizeCity(trip.location);
        if (city && CITY_COORDS[city]) {
          checkedCities.add(city);
        }
        // 省份匹配：先用 normalizeCity 得到城市名，再查 PROVINCE_MAP
        const province = PROVINCE_MAP[city];
        if (province) {
          visitedProvinces.add(province);
        } else {
          // 兜底：直接用原始 location 模糊匹配省份
          for (let k in PROVINCE_MAP) {
            if (trip.location && trip.location.includes(k)) {
              visitedProvinces.add(PROVINCE_MAP[k]);
              break;
            }
          }
        }
      });

      const citiesArr = Array.from(checkedCities);
      const provincesArr = Array.from(visitedProvinces);

      // 构建地图 markers
      const markers = citiesArr.map((city, idx) => {
        const coord = CITY_COORDS[city];
        return {
          id: idx,
          longitude: coord.lng,
          latitude: coord.lat,
          title: city,
          width: 30,
          height: 30,
          callout: {
            content: city,
            color: '#07c160',
            fontSize: 13,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#07c160',
            bgColor: '#ffffff',
            padding: 5,
            display: 'ALWAYS'
          }
        };
      });

      this.setData({
        visitedCities: citiesArr,
        markers,
        stats: {
          cities: citiesArr.length,
          provinces: provincesArr.length,
          total: trips.filter(t => t.checked).length,
          provincesList: provincesArr
        }
      });
    } catch (e) {
      wx.showToast({ title: '地图数据加载失败', icon: 'none' });
    }
  },

  onCityTap(e) {
    const city = e.currentTarget.dataset.city;
    const coord = CITY_COORDS[city];
    if (!coord) {
      wx.showToast({ title: city, icon: 'none' });
      return;
    }
    this.setData({
      mapCenter: [coord.lng, coord.lat],
      mapScale: 10
    });
  },

  onMarkerTap(e) {
    const idx = e.markerId;
    const city = this.data.visitedCities[idx];
    if (city) wx.showToast({ title: city, icon: 'none' });
  },

  resetView() {
    this.setData({
      mapCenter: CHINA_CENTER,
      mapScale: 4
    });
  }
});
