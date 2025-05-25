const RequestUtil = require('../utils/request');
const FirestoreService = require('./firestore');

class ReservationService {
  constructor() {
    this.firestoreService = new FirestoreService();
    console.log('ReservationService 초기화 완료');
  }

  /**
   * 하교 노선 목록 조회
   */
  async getFromSchoolRoutes(userId, requestUtil) {
    try {
      const response = await requestUtil.get('index.php?ctrl=BusReserve&action=lineList&dir=DOWN');
      
      console.log(`[${userId}] 하교 노선 응답 데이터:`, JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.result === 'OK') {
        let routeList = Array.isArray(response.data.list) ? response.data.list : 
                       (response.data.data && Array.isArray(response.data.data.list)) ? response.data.data.list :
                       (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
        
        // 필드 이름 매핑
        routeList = routeList.map(route => ({
          seq: route.lineGroupSeq || route.seq,
          lineName: route.groupName || route.lineName,
          busCnt: route.busCnt,
          stopList: route.stopList || [{ seq: '1', stopName: '기본 정류장', dispatchName: '' }]
        }));
        
        console.log(`[${userId}] 하교 노선 ${routeList.length}개 조회 성공`);
        return {
          success: true,
          routes: routeList
        };
      } else {
        console.log(`[${userId}] 하교 노선 조회 실패: ${response.data.msg || response.data.resultMsg || '알 수 없는 오류'}`);
        return {
          success: false,
          message: response.data.msg || response.data.resultMsg || '노선 조회 실패'
        };
      }
    } catch (error) {
      console.error(`[${userId}] 하교 노선 조회 오류:`, error.message);
      return {
        success: false,
        message: '노선 조회 중 오류 발생',
        error: error.message
      };
    }
  }

  /**
   * 등교 노선 목록 조회
   */
  async getToSchoolRoutes(userId, requestUtil) {
    try {
      const response = await requestUtil.get('index.php?ctrl=BusReserve&action=lineList&dir=UP');
      
      console.log(`[${userId}] 등교 노선 응답 데이터:`, JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.result === 'OK') {
        let routeList = Array.isArray(response.data.list) ? response.data.list : 
                       (response.data.data && Array.isArray(response.data.data.list)) ? response.data.data.list :
                       (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
        
        if (routeList.length === 0) {
          console.log(`[${userId}] 등교 노선 0개 조회됨`);
          return {
            success: true,
            routes: []
          };
        }
        
        routeList = routeList.map(route => ({
          seq: route.lineGroupSeq || route.seq,
          lineName: route.groupName || route.lineName,
          busCnt: route.busCnt,
          stopList: route.stopList || [{ seq: '1', stopName: '기본 정류장', dispatchName: '' }]
        }));
        
        console.log(`[${userId}] 등교 노선 ${routeList.length}개 조회 성공`);
        return {
          success: true,
          routes: routeList
        };
      } else {
        console.log(`[${userId}] 등교 노선 조회 실패: ${response.data.msg || response.data.resultMsg || '알 수 없는 오류'}`);
        return {
          success: false,
          message: response.data.msg || response.data.resultMsg || '노선 조회 실패'
        };
      }
    } catch (error) {
      console.error(`[${userId}] 등교 노선 조회 오류:`, error.message);
      return {
        success: false,
        message: '노선 조회 중 오류 발생',
        error: error.message
      };
    }
  }

  /**
   * 버스 운행 시간표 조회
   */
  async getBusTimetable(userId, requestUtil, lineSeq, direction = 'DOWN') {
    try {
      console.log(`[${userId}] 버스 시간표 조회 시도 (lineGroupSeq: ${lineSeq}, direction: ${direction})`);
      
      const response = await requestUtil.get(
        `index.php?ctrl=BusReserve&action=busList&dir=${direction}&lineGroupSeq=${lineSeq}`
      );
      
      console.log(`[${userId}] busList 액션으로 시간표 조회 응답:`, JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.result === 'OK') {
        let timeList = [];
        let stopList = [];
        
        if (response.data.data && Array.isArray(response.data.data.busList)) {
          timeList = response.data.data.busList;
        } else if (response.data.busList && Array.isArray(response.data.busList)) {
          timeList = response.data.busList;
        }
        
        if (response.data.data && Array.isArray(response.data.data.stopList)) {
          stopList = response.data.data.stopList;
        } else if (response.data.stopList && Array.isArray(response.data.stopList)) {
          stopList = response.data.stopList;
        }
        
        console.log(`[${userId}] 버스 시간표 ${timeList.length}개 조회 성공`);
        console.log(`[${userId}] 정류장 ${stopList.length}개 조회됨`);
        
        return {
          success: true,
          timetable: timeList,
          stopList: stopList
        };
      } else {
        console.log(`[${userId}] 버스 시간표 조회 실패: ${response.data.msg || response.data.resultMsg || '알 수 없는 오류'}`);
        return {
          success: false,
          message: response.data.msg || response.data.resultMsg || '시간표 조회 실패'
        };
      }
    } catch (error) {
      console.error(`[${userId}] 버스 시간표 조회 오류:`, error.message);
      return {
        success: false,
        message: '시간표 조회 중 오류 발생',
        error: error.message
      };
    }
  }

  /**
   * 버스 좌석 정보 조회
   */
  async getBusSeats(userId, requestUtil, busSeq) {
    try {
      console.log(`[${userId}] 버스 좌석 정보 조회 시도 (busSeq: ${busSeq})`);
      
      let response;
      
      // busSeatInfo 액션 시도
      try {
        response = await requestUtil.get(`index.php?ctrl=BusReserve&action=busSeatInfo&busSeq=${busSeq}`);
        console.log(`[${userId}] busSeatInfo 액션으로 좌석 조회 응답:`, JSON.stringify(response.data, null, 2));
      } catch (firstError) {
        console.log(`[${userId}] busSeatInfo 액션 실패, seatInfo 액션으로 재시도`);
        response = await requestUtil.get(`index.php?ctrl=BusReserve&action=seatInfo&busSeq=${busSeq}`);
        console.log(`[${userId}] seatInfo 액션으로 좌석 조회 응답:`, JSON.stringify(response.data, null, 2));
      }
      
      if (response.data && response.data.result === 'OK') {
        let seatData = null;
        
        if (response.data.data && response.data.data.seatList) {
          seatData = response.data.data;
        } else if (response.data.seatList) {
          seatData = response.data;
        }
        
        if (seatData) {
          console.log(`[${userId}] 버스 좌석 정보 조회 성공`);
          return {
            success: true,
            seats: seatData
          };
        } else {
          console.log(`[${userId}] 좌석 데이터가 응답에 없음`);
          return {
            success: false,
            message: '좌석 데이터를 찾을 수 없음'
          };
        }
      } else {
        console.log(`[${userId}] 버스 좌석 조회 실패: ${response.data.msg || response.data.resultMsg || '알 수 없는 오류'}`);
        return {
          success: false,
          message: response.data.msg || response.data.resultMsg || '좌석 조회 실패'
        };
      }
    } catch (error) {
      console.error(`[${userId}] 버스 좌석 조회 오류:`, error.message);
      return {
        success: false,
        message: '좌석 조회 중 오류 발생',
        error: error.message
      };
    }
  }

  /**
   * 버스 예약 실행
   */
  async reserveBus(userId, requestUtil, { busSeq, lineSeq, stopSeq, seatNo }) {
    try {
      console.log(`[${userId}] 버스 예약 실행 (busSeq: ${busSeq}, seatNo: ${seatNo})`);
      
      const response = await requestUtil.post(
        'index.php?ctrl=BusReserve&action=reserveBus',
        {
          busSeq: busSeq,
          lineGroupSeq: lineSeq,
          stopSeq: stopSeq,
          seatNo: seatNo
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`[${userId}] 예약 응답:`, JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.result === 'OK') {
        console.log(`[${userId}] 버스 예약 성공!`);
        return {
          success: true,
          reservationNumber: response.data.data?.reservationNumber || 'N/A',
          seatNumber: seatNo,
          message: response.data.msg || response.data.resultMsg || '예약 성공'
        };
      } else {
        console.log(`[${userId}] 버스 예약 실패: ${response.data.msg || response.data.resultMsg || '알 수 없는 오류'}`);
        return {
          success: false,
          message: response.data.msg || response.data.resultMsg || '예약 실패'
        };
      }
    } catch (error) {
      console.error(`[${userId}] 버스 예약 오류:`, error.message);
      return {
        success: false,
        message: '예약 중 오류 발생',
        error: error.message
      };
    }
  }

  /**
   * 예약 취소
   */
  async cancelReservation(userId, requestUtil, reservationInfo) {
    try {
      console.log(`[${userId}] 예약 취소 시도:`, reservationInfo);
      
      const response = await requestUtil.post(
        'index.php?ctrl=BusReserve&action=cancelReservation',
        reservationInfo,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`[${userId}] 예약 취소 응답:`, JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.result === 'OK') {
        console.log(`[${userId}] 예약 취소 성공`);
        return {
          success: true,
          message: response.data.msg || response.data.resultMsg || '예약 취소 성공'
        };
      } else {
        console.log(`[${userId}] 예약 취소 실패: ${response.data.msg || response.data.resultMsg || '알 수 없는 오류'}`);
        return {
          success: false,
          message: response.data.msg || response.data.resultMsg || '예약 취소 실패'
        };
      }
    } catch (error) {
      console.error(`[${userId}] 예약 취소 오류:`, error.message);
      return {
        success: false,
        message: '예약 취소 중 오류 발생',
        error: error.message
      };
    }
  }

  /**
   * 통합 예약 실행 (기존 backend-api 로직)
   */
  async makeReservation(userId, requestUtil, authToken, targetRoute, targetTime, preferredSeats = []) {
    const startTime = Date.now();
    
    try {
      console.log(`[${userId}] 예약 실행 시작 - 노선: ${targetRoute}, 시간: ${targetTime}`);
      
      // 1. 하교 노선 정보 확인
      const routesResult = await this.getFromSchoolRoutes(userId, requestUtil);
      if (!routesResult.success) {
        throw new Error(`노선 정보 조회 실패: ${routesResult.message}`);
      }
      
      // 2. 버스 정보 매칭
      const targetRouteInfo = routesResult.routes.find(route => 
        route.lineName.includes(targetRoute)
      );
      
      if (!targetRouteInfo) {
        throw new Error(`지정한 노선(${targetRoute})을 찾을 수 없습니다.`);
      }
      
      console.log(`[${userId}] 노선 정보 확인: ${targetRouteInfo.lineName} (lineSeq: ${targetRouteInfo.seq})`);
      
      // 3. 버스 시간표 확인
      const timetableResult = await this.getBusTimetable(userId, requestUtil, targetRouteInfo.seq, 'DOWN');
      if (!timetableResult.success) {
        throw new Error(`시간표 조회 실패: ${timetableResult.message}`);
      }
      
      // 4. 시간표에서 원하는 시간의 버스 찾기
      const targetBus = timetableResult.timetable.find(bus => 
        bus.operateTime && bus.operateTime.includes(targetTime)
      );
      
      if (!targetBus) {
        throw new Error(`지정한 시간(${targetTime})의 버스를 찾을 수 없습니다.`);
      }
      
      console.log(`[${userId}] 버스 시간 확인: ${targetBus.operateTime} (busSeq: ${targetBus.seq})`);
      
      // 5. 버스 좌석 정보 확인
      const seatsResult = await this.getBusSeats(userId, requestUtil, targetBus.seq);
      if (!seatsResult.success) {
        throw new Error(`좌석 정보 조회 실패: ${seatsResult.message}`);
      }
      
      // 6. 좌석 선택 (선호 좌석 또는 사용 가능한 좌석)
      const seatInfo = seatsResult.seats;
      let selectedSeat = null;
      
      // 선호 좌석 확인
      for (const preferredSeat of preferredSeats) {
        if (seatInfo.seatList && seatInfo.seatList[preferredSeat] === '0') {
          selectedSeat = preferredSeat;
          break;
        }
      }
      
      // 선호 좌석이 없으면 사용 가능한 첫 번째 좌석
      if (!selectedSeat && seatInfo.seatList) {
        for (let i = 1; i <= 45; i++) {
          if (seatInfo.seatList[i] === '0') {
            selectedSeat = i;
            break;
          }
        }
      }
      
      if (!selectedSeat) {
        throw new Error('사용 가능한 좌석이 없습니다.');
      }
      
      console.log(`[${userId}] 선택된 좌석: ${selectedSeat}번`);
      
      // 7. 최종 예약 실행
      const reservationResult = await this.reserveBus(userId, requestUtil, {
        busSeq: targetBus.seq,
        lineSeq: targetRouteInfo.seq,
        stopSeq: targetRouteInfo.stopList[0]?.seq || '1',
        seatNo: selectedSeat
      });
      
      const executionTime = Date.now() - startTime;
      
      if (reservationResult.success) {
        console.log(`[${userId}] 예약 성공! 실행시간: ${executionTime}ms`);
        return {
          success: true,
          route: targetRouteInfo.lineName,
          time: targetBus.operateTime,
          seatNumber: selectedSeat,
          reservationNumber: reservationResult.reservationNumber,
          executionTimeMs: executionTime
        };
      } else {
        throw new Error(reservationResult.message);
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[${userId}] 예약 실패 (${executionTime}ms):`, error.message);
      throw { ...error, executionTimeMs: executionTime };
    }
  }

  /**
   * 대량 예약 처리
   */
  async batchReservation(reservationRequests) {
    console.log(`🚌 대량 예약 시작: ${reservationRequests.length}개 요청`);
    
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const request of reservationRequests) {
      const startTime = Date.now();
      let result = {
        userId: request.userId,
        success: false,
        executionTimeMs: 0
      };

      try {
        console.log(`[${request.userId}] 예약 요청 시작`);

        // 1. 노선 정보 조회
        const routes = await this.getFromSchoolRoutes(request.userId, request.requestUtil);
        const targetRoute = routes.find(route => 
          route.lineName.includes(request.targetRoute)
        );

        if (!targetRoute) {
          throw new Error(`노선을 찾을 수 없습니다: ${request.targetRoute}`);
        }

        // 2. 시간표 조회
        const timetable = await this.getBusTimetable(
          request.userId, 
          request.requestUtil, 
          targetRoute.seq, 
          'DOWN'
        );

        const targetBus = timetable.timetable.find(bus => 
          bus.operateTime && bus.operateTime.includes(request.targetTime)
        );

        if (!targetBus) {
          throw new Error(`대상 시간의 버스를 찾을 수 없습니다: ${request.targetTime}`);
        }

        // 3. 좌석 조회
        const seatInfo = await this.getBusSeats(
          request.userId,
          request.requestUtil,
          targetBus.seq
        );

        // 4. 최적 좌석 선택
        const selectedSeat = this.selectOptimalSeat(
          seatInfo.seats,
          request.preferredSeats
        );

        if (!selectedSeat) {
          throw new Error('예약 가능한 좌석이 없습니다');
        }

        // 5. 예약 실행
        const reservationResult = await this.makeReservation(
          request.userId,
          request.requestUtil,
          {
            busSeq: targetBus.seq,
            seatSeq: selectedSeat.seq,
            authToken: request.authToken
          }
        );

        // 성공 결과 저장
        result.success = true;
        result.route = targetRoute.lineName;
        result.time = targetBus.operateTime;
        result.seatNumber = selectedSeat.seatNo;
        result.reservationInfo = reservationResult;
        successCount++;

        console.log(`[${request.userId}] ✅ 예약 성공: ${selectedSeat.seatNo}번 좌석`);

      } catch (error) {
        console.error(`[${request.userId}] ❌ 예약 실패:`, error.message);
        result.error = error.message;
        failedCount++;
      }

      result.executionTimeMs = Date.now() - startTime;
      results.push(result);
    }

    const totalExecutionTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0);
    
    console.log(`🎯 대량 예약 완료: ${successCount}/${reservationRequests.length} 성공`);
    
    return {
      total: reservationRequests.length,
      success: successCount,
      failed: failedCount,
      results: results,
      totalExecutionTime: totalExecutionTime,
      averageExecutionTime: totalExecutionTime / reservationRequests.length
    };
  }

  /**
   * 최적 좌석 선택 (개선된 로직)
   */
  selectOptimalSeat(seats, preferredSeats = []) {
    console.log(`좌석 선택 시작: 총 ${seats.length}개 좌석, 선호좌석 ${preferredSeats.length}개`);
    
    // 예약 가능한 좌석만 필터링
    const availableSeats = seats.filter(seat => seat.status === 'available');
    
    if (availableSeats.length === 0) {
      console.log('예약 가능한 좌석이 없습니다.');
      return null;
    }
    
    // 선호 좌석이 있으면 우선 확인
    if (preferredSeats.length > 0) {
      for (const preferredSeat of preferredSeats) {
        const foundSeat = availableSeats.find(seat => 
          seat.seatNo === preferredSeat || 
          seat.seatNo === String(preferredSeat)
        );
        
        if (foundSeat) {
          console.log(`선호 좌석 선택: ${foundSeat.seatNo}`);
          return foundSeat;
        }
      }
    }
    
    // 선호 좌석이 없으면 최적 좌석 자동 선택
    // 우선순위: 앞쪽 > 뒤쪽, 창가 > 복도
    const sortedSeats = availableSeats.sort((a, b) => {
      // 행 번호 우선 (앞쪽이 좋음)
      const rowA = parseInt(a.seatNo.match(/\d+/)?.[0] || '99');
      const rowB = parseInt(b.seatNo.match(/\d+/)?.[0] || '99');
      
      if (rowA !== rowB) {
        return rowA - rowB;
      }
      
      // 같은 행이면 창가 우선 (A, D가 창가)
      const seatTypeA = a.seatNo.match(/[A-D]$/)?.[0] || '';
      const seatTypeB = b.seatNo.match(/[A-D]$/)?.[0] || '';
      
      const windowSeats = ['A', 'D'];
      const isWindowA = windowSeats.includes(seatTypeA);
      const isWindowB = windowSeats.includes(seatTypeB);
      
      if (isWindowA && !isWindowB) return -1;
      if (!isWindowA && isWindowB) return 1;
      
      return 0;
    });
    
    const selectedSeat = sortedSeats[0];
    console.log(`자동 선택 좌석: ${selectedSeat.seatNo}`);
    return selectedSeat;
  }

  /**
   * 간편 노선 조회 (방향 통합)
   */
  async getRoutes(userId, requestUtil, authToken) {
    try {
      const [downRoutes, upRoutes] = await Promise.all([
        this.getFromSchoolRoutes(userId, requestUtil),
        this.getToSchoolRoutes(userId, requestUtil)
      ]);

      return {
        down: downRoutes.success ? downRoutes.routes : [],
        up: upRoutes.success ? upRoutes.routes : [],
        total: (downRoutes.success ? downRoutes.routes.length : 0) + 
               (upRoutes.success ? upRoutes.routes.length : 0)
      };
    } catch (error) {
      console.error(`[${userId}] 노선 조회 오류:`, error.message);
      return {
        down: [],
        up: [],
        total: 0,
        error: error.message
      };
    }
  }
}

module.exports = ReservationService; 