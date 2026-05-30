import { PrismaClient, Role, SubmissionStatus, WorkflowInstanceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASSWORD = 'Test@12345';

async function main() {
  console.log('=== FlowForm - Seed dữ liệu Học viện ===\n');

  // ---- 1. Tenant ----
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'default' },
    create: { name: 'Học viện Công nghệ Bưu chính Viễn thông', domain: 'default' },
    update: { name: 'Học viện Công nghệ Bưu chính Viễn thông' },
  });
  const tenantId = tenant.id;
  console.log(`Tenant: ${tenant.name}`);

  // ---- 2. Users: Ban Giám đốc, Trưởng phòng, Nhân sự, Giảng viên/Chuyên viên ----
  const hash = await bcrypt.hash(PASSWORD, 10);

  const users = [
    { email: 'admin@ptit.edu.vn', username: 'admin', role: Role.ADMIN, firstName: 'Nguyễn Văn', lastName: 'Hùng', title: 'Quản trị hệ thống' },
    { email: 'pgs.truong@ptit.edu.vn', username: 'truongphong_dt', role: Role.MANAGER, firstName: 'Trần Quốc', lastName: 'Trường', title: 'Trưởng phòng Đào tạo' },
    { email: 'ts.minh@ptit.edu.vn', username: 'truongphong_tcns', role: Role.MANAGER, firstName: 'Lê Hoàng', lastName: 'Minh', title: 'Trưởng phòng Tổ chức Nhân sự' },
    { email: 'ths.hoa@ptit.edu.vn', username: 'truongphong_khtc', role: Role.MANAGER, firstName: 'Phạm Thị', lastName: 'Hoa', title: 'Trưởng phòng Kế hoạch Tài chính' },
    { email: 'cv.linh@ptit.edu.vn', username: 'nhansu_linh', role: Role.HR, firstName: 'Vũ Thùy', lastName: 'Linh', title: 'Chuyên viên Nhân sự' },
    { email: 'cv.nam@ptit.edu.vn', username: 'nhansu_nam', role: Role.HR, firstName: 'Đỗ Thành', lastName: 'Nam', title: 'Chuyên viên Nhân sự' },
    { email: 'gv.duc@ptit.edu.vn', username: 'giangvien_duc', role: Role.USER, firstName: 'Hoàng Tiến', lastName: 'Đức', title: 'Giảng viên Khoa CNTT' },
    { email: 'gv.mai@ptit.edu.vn', username: 'giangvien_mai', role: Role.USER, firstName: 'Ngô Thanh', lastName: 'Mai', title: 'Giảng viên Khoa Viễn thông' },
    { email: 'cv.tuan@ptit.edu.vn', username: 'chuyenvien_tuan', role: Role.USER, firstName: 'Bùi Anh', lastName: 'Tuấn', title: 'Chuyên viên phòng Đào tạo' },
    { email: 'gv.an@ptit.edu.vn', username: 'giangvien_an', role: Role.USER, firstName: 'Đinh Quốc', lastName: 'An', title: 'Giảng viên Khoa QTKD' },
  ];

  const userMap: Record<string, string> = {};
  for (const u of users) {
    const existing = await prisma.user.findFirst({ where: { tenantId, OR: [{ email: u.email }, { username: u.username }] } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, passwordHash: hash } });
      userMap[u.username] = existing.id;
    } else {
      const created = await prisma.user.create({
        data: { tenantId, email: u.email, username: u.username, passwordHash: hash, role: u.role, firstName: u.firstName, lastName: u.lastName, isActive: true },
      });
      userMap[u.username] = created.id;
    }
    console.log(`  ${u.role.padEnd(7)} | ${u.email.padEnd(28)} | ${u.firstName} ${u.lastName} - ${u.title}`);
  }
  console.log(`\n  Mật khẩu tất cả tài khoản: ${PASSWORD}\n`);

  // ---- 3. Forms: Biểu mẫu hành chính Học viện ----
  const formDefs = [
    {
      name: 'Đơn xin nghỉ phép',
      description: 'Cán bộ, giảng viên đăng ký nghỉ phép theo quy định của Học viện',
      schema: {
        formId: 'nghi-phep',
        fields: [
          { key: 'loaiNghi', label: 'Loại nghỉ phép', type: 'select', rules: { required: true }, options: [
            { label: 'Nghỉ phép năm', value: 'phep_nam' },
            { label: 'Nghỉ ốm', value: 'nghi_om' },
            { label: 'Nghỉ việc riêng (không lương)', value: 'viec_rieng' },
            { label: 'Nghỉ chế độ (thai sản, cưới...)', value: 'che_do' },
          ]},
          { key: 'ngayBatDau', label: 'Ngày bắt đầu nghỉ', type: 'date', rules: { required: true } },
          { key: 'soNgay', label: 'Số ngày nghỉ', type: 'number', rules: { required: true, min: 0.5, max: 30 } },
          { key: 'lyDo', label: 'Lý do nghỉ phép', type: 'text', rules: { required: true, minLength: 10 } },
          { key: 'nguoiThayThe', label: 'Người thay thế công việc', type: 'text', rules: { required: true } },
        ],
      },
    },
    {
      name: 'Đề xuất mua sắm thiết bị',
      description: 'Đề xuất mua sắm vật tư, thiết bị phục vụ giảng dạy và nghiên cứu',
      schema: {
        formId: 'mua-sam',
        fields: [
          { key: 'tenThietBi', label: 'Tên thiết bị / vật tư', type: 'text', rules: { required: true } },
          { key: 'soLuong', label: 'Số lượng', type: 'number', rules: { required: true, min: 1 } },
          { key: 'donGiaDuKien', label: 'Đơn giá dự kiến (VNĐ)', type: 'number', rules: { required: true, min: 0 } },
          { key: 'donViDeXuat', label: 'Đơn vị đề xuất', type: 'select', rules: { required: true }, options: [
            { label: 'Khoa CNTT', value: 'cntt' },
            { label: 'Khoa Viễn thông', value: 'vt' },
            { label: 'Khoa QTKD', value: 'qtkd' },
            { label: 'Phòng Đào tạo', value: 'dt' },
            { label: 'Trung tâm Thư viện', value: 'tv' },
            { label: 'Phòng Hành chính', value: 'hc' },
          ]},
          { key: 'mucDich', label: 'Mục đích sử dụng', type: 'text', rules: { required: true, minLength: 15 } },
          { key: 'tinhCap', label: 'Mức độ ưu tiên', type: 'select', rules: { required: true }, options: [
            { label: 'Bình thường', value: 'binh_thuong' },
            { label: 'Cấp bách', value: 'cap_bach' },
            { label: 'Khẩn cấp', value: 'khan_cap' },
          ]},
        ],
      },
    },
    {
      name: 'Đăng ký đề tài NCKH',
      description: 'Đăng ký thực hiện đề tài nghiên cứu khoa học cấp Học viện',
      schema: {
        formId: 'dang-ky-nckh',
        fields: [
          { key: 'tenDeTai', label: 'Tên đề tài', type: 'text', rules: { required: true, minLength: 10 } },
          { key: 'linhVuc', label: 'Lĩnh vực nghiên cứu', type: 'select', rules: { required: true }, options: [
            { label: 'Công nghệ thông tin', value: 'cntt' },
            { label: 'Viễn thông', value: 'vt' },
            { label: 'An toàn thông tin', value: 'attt' },
            { label: 'Truyền thông đa phương tiện', value: 'ttdpt' },
            { label: 'Quản trị kinh doanh', value: 'qtkd' },
          ]},
          { key: 'capDeTai', label: 'Cấp đề tài', type: 'select', rules: { required: true }, options: [
            { label: 'Cấp cơ sở', value: 'co_so' },
            { label: 'Cấp Bộ', value: 'cap_bo' },
            { label: 'Cấp Nhà nước', value: 'cap_nn' },
          ]},
          { key: 'kinhPhi', label: 'Kinh phí dự kiến (triệu VNĐ)', type: 'number', rules: { required: true, min: 5 } },
          { key: 'thoiGian', label: 'Thời gian thực hiện (tháng)', type: 'number', rules: { required: true, min: 3, max: 36 } },
          { key: 'tomTat', label: 'Tóm tắt nội dung nghiên cứu', type: 'text', rules: { required: true, minLength: 50 } },
        ],
      },
    },
    {
      name: 'Đề xuất tổ chức sự kiện',
      description: 'Đề xuất tổ chức hội thảo, workshop, sự kiện học thuật tại Học viện',
      schema: {
        formId: 'to-chuc-su-kien',
        fields: [
          { key: 'tenSuKien', label: 'Tên sự kiện', type: 'text', rules: { required: true } },
          { key: 'loaiSuKien', label: 'Loại sự kiện', type: 'select', rules: { required: true }, options: [
            { label: 'Hội thảo khoa học', value: 'hoi_thao' },
            { label: 'Workshop / Seminar', value: 'workshop' },
            { label: 'Cuộc thi sinh viên', value: 'cuoc_thi' },
            { label: 'Lễ tốt nghiệp / Khai giảng', value: 'le_lon' },
            { label: 'Đào tạo nội bộ', value: 'dao_tao_nb' },
          ]},
          { key: 'ngayToChuc', label: 'Ngày tổ chức dự kiến', type: 'date', rules: { required: true } },
          { key: 'soLuongThamGia', label: 'Số lượng tham gia dự kiến', type: 'number', rules: { required: true, min: 10 } },
          { key: 'kinhPhiDuKien', label: 'Kinh phí dự kiến (VNĐ)', type: 'number', rules: { required: true, min: 0 } },
          { key: 'moTa', label: 'Mô tả chi tiết sự kiện', type: 'text', rules: { required: true, minLength: 20 } },
        ],
      },
    },
    {
      name: 'Đơn xin công tác',
      description: 'Đăng ký đi công tác, hội nghị, tập huấn bên ngoài Học viện',
      schema: {
        formId: 'xin-cong-tac',
        fields: [
          { key: 'diaDiem', label: 'Địa điểm công tác', type: 'text', rules: { required: true } },
          { key: 'mucDich', label: 'Mục đích công tác', type: 'text', rules: { required: true, minLength: 10 } },
          { key: 'ngayDi', label: 'Ngày đi', type: 'date', rules: { required: true } },
          { key: 'ngayVe', label: 'Ngày về', type: 'date', rules: { required: true } },
          { key: 'phuongTien', label: 'Phương tiện di chuyển', type: 'select', rules: { required: true }, options: [
            { label: 'Xe cơ quan', value: 'xe_cq' },
            { label: 'Máy bay', value: 'may_bay' },
            { label: 'Tàu hỏa', value: 'tau' },
            { label: 'Tự túc', value: 'tu_tuc' },
          ]},
          { key: 'kinhPhi', label: 'Kinh phí đề xuất (VNĐ)', type: 'number', rules: { required: true, min: 0 } },
        ],
      },
    },
  ];

  const formMap: Record<string, string> = {};
  for (const f of formDefs) {
    const existing = await prisma.form.findFirst({ where: { tenantId, name: f.name } });
    if (existing) { formMap[f.name] = existing.id; }
    else {
      const created = await prisma.form.create({
        data: { tenantId, name: f.name, description: f.description, schema: f.schema as any, settings: {} as any, isActive: true, createdBy: userMap['admin'] },
      });
      formMap[f.name] = created.id;
    }
    console.log(`Biểu mẫu: ${f.name}`);
  }

  // ---- 4. Workflows ----

  // 4a. Nghỉ phép: Trưởng phòng -> Nhân sự -> Ban Giám đốc (tuần tự 3 bước)
  const wfNghiPhep = {
    states: ['cho_truong_phong', 'cho_nhan_su', 'cho_ban_giam_doc', 'da_duyet', 'tu_choi', 'tra_lai'],
    initialState: 'cho_truong_phong',
    finalStates: ['da_duyet', 'tu_choi', 'tra_lai'],
    transitions: [
      { from: 'cho_truong_phong', to: 'cho_nhan_su', action: 'approve', roles: ['MANAGER'] },
      { from: 'cho_truong_phong', to: 'tu_choi', action: 'reject', roles: ['MANAGER'], conditions: { requireComment: true } },
      { from: 'cho_truong_phong', to: 'tra_lai', action: 'return_for_edit', roles: ['MANAGER'], conditions: { requireComment: true } },
      { from: 'cho_nhan_su', to: 'cho_ban_giam_doc', action: 'approve', roles: ['HR'] },
      { from: 'cho_nhan_su', to: 'tu_choi', action: 'reject', roles: ['HR'], conditions: { requireComment: true } },
      { from: 'cho_ban_giam_doc', to: 'da_duyet', action: 'approve', roles: ['ADMIN'] },
      { from: 'cho_ban_giam_doc', to: 'tu_choi', action: 'reject', roles: ['ADMIN'], conditions: { requireComment: true } },
    ],
    statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED', tra_lai: 'RETURNED' },
    statesDetails: { cho_truong_phong: { slaHours: 24, timeoutAction: 'approve' }, cho_nhan_su: { slaHours: 48 }, cho_ban_giam_doc: { slaHours: 24 } },
  };

  // 4b. Mua sắm: Trưởng phòng + Tài chính đồng thời duyệt (song song)
  const wfMuaSam = {
    states: ['cho_duyet', 'da_duyet', 'tu_choi'],
    initialState: 'cho_duyet',
    finalStates: ['da_duyet', 'tu_choi'],
    transitions: [
      { from: 'cho_duyet', to: 'da_duyet', action: 'approve_truong_phong', roles: ['MANAGER', 'HR'], type: 'PARALLEL_JOIN', requireActions: ['approve_truong_phong', 'approve_tai_chinh'] },
      { from: 'cho_duyet', to: 'tu_choi', action: 'reject', roles: ['MANAGER'], conditions: { requireComment: true } },
      { from: 'cho_duyet', to: 'tu_choi', action: 'reject', roles: ['HR'], conditions: { requireComment: true } },
    ],
    statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
    statesDetails: { cho_duyet: { slaHours: 72 } },
  };

  // 4c. NCKH: Hội đồng khoa học bỏ phiếu 2/3 (voting)
  const wfNCKH = {
    states: ['nop_ho_so', 'hoi_dong_xet_duyet', 'da_duyet', 'tu_choi'],
    initialState: 'nop_ho_so',
    finalStates: ['da_duyet', 'tu_choi'],
    transitions: [
      { from: 'nop_ho_so', to: 'hoi_dong_xet_duyet', action: 'start_review', roles: ['ADMIN', 'MANAGER'] },
      { from: 'hoi_dong_xet_duyet', to: 'da_duyet', action: 'vote_approve', roles: ['MANAGER'], type: 'VOTING',
        votingConfig: { approveAction: 'vote_approve', rejectAction: 'vote_reject', approveThreshold: 2, rejectThreshold: 2, approveTarget: 'da_duyet', rejectTarget: 'tu_choi' } },
    ],
    statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
    statesDetails: { hoi_dong_xet_duyet: { slaHours: 120 } },
  };

  // 4d. Sự kiện: Trưởng phòng duyệt (đơn giản)
  const wfSuKien = {
    states: ['cho_duyet', 'da_duyet', 'tu_choi'],
    initialState: 'cho_duyet',
    finalStates: ['da_duyet', 'tu_choi'],
    transitions: [
      { from: 'cho_duyet', to: 'da_duyet', action: 'approve', roles: ['MANAGER'] },
      { from: 'cho_duyet', to: 'tu_choi', action: 'reject', roles: ['MANAGER'], conditions: { requireComment: true } },
    ],
    statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
  };

  // 4e. Công tác: Trưởng phòng -> Tài chính (tuần tự 2 bước)
  const wfCongTac = {
    states: ['cho_truong_phong', 'cho_tai_chinh', 'da_duyet', 'tu_choi'],
    initialState: 'cho_truong_phong',
    finalStates: ['da_duyet', 'tu_choi'],
    transitions: [
      { from: 'cho_truong_phong', to: 'cho_tai_chinh', action: 'approve', roles: ['MANAGER'] },
      { from: 'cho_truong_phong', to: 'tu_choi', action: 'reject', roles: ['MANAGER'], conditions: { requireComment: true } },
      { from: 'cho_tai_chinh', to: 'da_duyet', action: 'approve', roles: ['MANAGER'] },
      { from: 'cho_tai_chinh', to: 'tu_choi', action: 'reject', roles: ['MANAGER'], conditions: { requireComment: true } },
    ],
    statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
    statesDetails: { cho_truong_phong: { slaHours: 24 }, cho_tai_chinh: { slaHours: 48 } },
  };

  const wfDefs = [
    { name: 'Quy trình duyệt nghỉ phép', formName: 'Đơn xin nghỉ phép', config: wfNghiPhep },
    { name: 'Quy trình duyệt mua sắm', formName: 'Đề xuất mua sắm thiết bị', config: wfMuaSam },
    { name: 'Quy trình xét duyệt đề tài NCKH', formName: 'Đăng ký đề tài NCKH', config: wfNCKH },
    { name: 'Quy trình duyệt sự kiện', formName: 'Đề xuất tổ chức sự kiện', config: wfSuKien },
    { name: 'Quy trình duyệt công tác', formName: 'Đơn xin công tác', config: wfCongTac },
  ];

  const wfMap: Record<string, string> = {};
  for (const wf of wfDefs) {
    const existing = await prisma.workflowDefinition.findFirst({ where: { tenantId, name: wf.name } });
    if (existing) { wfMap[wf.name] = existing.id; }
    else {
      const created = await prisma.workflowDefinition.create({
        data: { tenantId, name: wf.name, formId: formMap[wf.formName], config: wf.config as any, createdBy: userMap['admin'] },
      });
      wfMap[wf.name] = created.id;
    }
    console.log(`Quy trình: ${wf.name}`);
  }

  // ---- 5. Submissions ----
  const subs = [
    // Nghỉ phép - đang chờ trưởng phòng
    { form: 'Đơn xin nghỉ phép', wf: 'Quy trình duyệt nghỉ phép', user: 'giangvien_duc', step: 'cho_truong_phong', status: SubmissionStatus.UNDER_REVIEW,
      data: { loaiNghi: 'phep_nam', ngayBatDau: '2026-06-16', soNgay: 3, lyDo: 'Về quê thăm gia đình nhân dịp hè', nguoiThayThe: 'ThS. Ngô Thanh Mai' } },
    // Nghỉ phép - đang chờ nhân sự (đã qua bước trưởng phòng)
    { form: 'Đơn xin nghỉ phép', wf: 'Quy trình duyệt nghỉ phép', user: 'giangvien_mai', step: 'cho_nhan_su', status: SubmissionStatus.UNDER_REVIEW,
      data: { loaiNghi: 'nghi_om', ngayBatDau: '2026-06-10', soNgay: 2, lyDo: 'Khám sức khỏe định kỳ tại Bệnh viện Bạch Mai', nguoiThayThe: 'TS. Hoàng Tiến Đức' } },
    // Nghỉ phép - đã duyệt
    { form: 'Đơn xin nghỉ phép', wf: 'Quy trình duyệt nghỉ phép', user: 'chuyenvien_tuan', step: 'da_duyet', status: SubmissionStatus.APPROVED, instanceStatus: WorkflowInstanceStatus.COMPLETED,
      data: { loaiNghi: 'che_do', ngayBatDau: '2026-05-20', soNgay: 1, lyDo: 'Tham dự lễ cưới em gái', nguoiThayThe: 'Đồng nghiệp phòng Đào tạo' } },
    // Nghỉ phép - bị từ chối
    { form: 'Đơn xin nghỉ phép', wf: 'Quy trình duyệt nghỉ phép', user: 'giangvien_an', step: 'tu_choi', status: SubmissionStatus.REJECTED, instanceStatus: WorkflowInstanceStatus.COMPLETED,
      data: { loaiNghi: 'phep_nam', ngayBatDau: '2026-05-12', soNgay: 10, lyDo: 'Du lịch cùng gia đình', nguoiThayThe: 'Chưa sắp xếp' } },

    // Mua sắm - chờ duyệt song song
    { form: 'Đề xuất mua sắm thiết bị', wf: 'Quy trình duyệt mua sắm', user: 'giangvien_duc', step: 'cho_duyet', status: SubmissionStatus.UNDER_REVIEW,
      data: { tenThietBi: 'Máy chủ Dell PowerEdge R750', soLuong: 2, donGiaDuKien: 120000000, donViDeXuat: 'cntt', mucDich: 'Phục vụ phòng Lab AI và Machine Learning cho sinh viên năm cuối', tinhCap: 'cap_bach' } },
    { form: 'Đề xuất mua sắm thiết bị', wf: 'Quy trình duyệt mua sắm', user: 'chuyenvien_tuan', step: 'cho_duyet', status: SubmissionStatus.UNDER_REVIEW,
      data: { tenThietBi: 'Máy chiếu Epson EB-2250U', soLuong: 5, donGiaDuKien: 25000000, donViDeXuat: 'dt', mucDich: 'Thay thế máy chiếu phòng học tầng 3 nhà A2 đã hỏng', tinhCap: 'binh_thuong' } },
    // Mua sắm - đã duyệt
    { form: 'Đề xuất mua sắm thiết bị', wf: 'Quy trình duyệt mua sắm', user: 'giangvien_mai', step: 'da_duyet', status: SubmissionStatus.APPROVED, instanceStatus: WorkflowInstanceStatus.COMPLETED,
      data: { tenThietBi: 'Bộ kit thí nghiệm IoT Arduino', soLuong: 30, donGiaDuKien: 1500000, donViDeXuat: 'vt', mucDich: 'Trang bị phòng thí nghiệm IoT cho môn học Hệ thống nhúng', tinhCap: 'binh_thuong' } },

    // NCKH - chờ hội đồng bỏ phiếu
    { form: 'Đăng ký đề tài NCKH', wf: 'Quy trình xét duyệt đề tài NCKH', user: 'giangvien_duc', step: 'hoi_dong_xet_duyet', status: SubmissionStatus.UNDER_REVIEW,
      data: { tenDeTai: 'Ứng dụng Deep Learning trong phát hiện tấn công mạng IoT', linhVuc: 'attt', capDeTai: 'co_so', kinhPhi: 50, thoiGian: 12, tomTat: 'Nghiên cứu và phát triển hệ thống phát hiện xâm nhập mạng IoT sử dụng mô hình Transformer, kết hợp kỹ thuật Federated Learning đảm bảo tính riêng tư dữ liệu' } },
    { form: 'Đăng ký đề tài NCKH', wf: 'Quy trình xét duyệt đề tài NCKH', user: 'giangvien_an', step: 'nop_ho_so', status: SubmissionStatus.UNDER_REVIEW,
      data: { tenDeTai: 'Phân tích tác động của chuyển đổi số đến hiệu quả quản trị đại học', linhVuc: 'qtkd', capDeTai: 'cap_bo', kinhPhi: 150, thoiGian: 24, tomTat: 'Đánh giá hiện trạng chuyển đổi số trong các trường đại học Việt Nam, xây dựng bộ tiêu chí đo lường và đề xuất mô hình quản trị đại học số phù hợp điều kiện Việt Nam' } },

    // Sự kiện - chờ duyệt
    { form: 'Đề xuất tổ chức sự kiện', wf: 'Quy trình duyệt sự kiện', user: 'giangvien_mai', step: 'cho_duyet', status: SubmissionStatus.UNDER_REVIEW,
      data: { tenSuKien: 'Hội thảo quốc gia về An toàn thông tin 2026', loaiSuKien: 'hoi_thao', ngayToChuc: '2026-09-15', soLuongThamGia: 200, kinhPhiDuKien: 50000000, moTa: 'Hội thảo quy tụ các chuyên gia ATTT trong nước, trình bày các nghiên cứu mới nhất về bảo mật AI và Zero Trust Architecture' } },
    // Sự kiện - đã duyệt
    { form: 'Đề xuất tổ chức sự kiện', wf: 'Quy trình duyệt sự kiện', user: 'chuyenvien_tuan', step: 'da_duyet', status: SubmissionStatus.APPROVED, instanceStatus: WorkflowInstanceStatus.COMPLETED,
      data: { tenSuKien: 'Workshop: Cloud Computing với AWS', loaiSuKien: 'workshop', ngayToChuc: '2026-05-25', soLuongThamGia: 50, kinhPhiDuKien: 5000000, moTa: 'Workshop thực hành triển khai ứng dụng trên AWS cho sinh viên năm 3-4 khoa CNTT' } },

    // Công tác - chờ trưởng phòng
    { form: 'Đơn xin công tác', wf: 'Quy trình duyệt công tác', user: 'giangvien_duc', step: 'cho_truong_phong', status: SubmissionStatus.UNDER_REVIEW,
      data: { diaDiem: 'Đại học Bách khoa Hà Nội', mucDich: 'Tham dự Hội nghị quốc gia về CNTT lần thứ 25 (VNICT 2026)', ngayDi: '2026-07-10', ngayVe: '2026-07-12', phuongTien: 'tu_tuc', kinhPhi: 3000000 } },
    // Công tác - đang chờ tài chính
    { form: 'Đơn xin công tác', wf: 'Quy trình duyệt công tác', user: 'giangvien_mai', step: 'cho_tai_chinh', status: SubmissionStatus.UNDER_REVIEW,
      data: { diaDiem: 'TP. Hồ Chí Minh - Đại học Bách Khoa', mucDich: 'Báo cáo tại hội thảo IEEE RIVF 2026', ngayDi: '2026-08-05', ngayVe: '2026-08-08', phuongTien: 'may_bay', kinhPhi: 8500000 } },
  ];

  let createdSubs = 0;
  for (const s of subs) {
    const formId = formMap[s.form]; const wfId = wfMap[s.wf]; const userId = userMap[s.user];
    if (!formId || !wfId || !userId) continue;

    const submission = await prisma.submission.create({
      data: { tenantId, formId, submittedBy: userId, data: s.data as any, status: s.status, revisionNumber: 1 },
    });
    const instStatus = (s as any).instanceStatus ?? WorkflowInstanceStatus.ACTIVE;
    const instance = await prisma.workflowInstance.create({
      data: { tenantId, definitionId: wfId, submissionId: submission.id, currentStep: s.step, status: instStatus },
    });

    // History: submit
    const config = (await prisma.workflowDefinition.findUnique({ where: { id: wfId } }))?.config as any;
    await prisma.workflowHistory.create({
      data: { tenantId, instanceId: instance.id, fromStep: null, toStep: config.initialState, action: 'SUBMIT', actorId: userId },
    });

    // Add intermediate history for steps past the initial
    if (s.step === 'cho_nhan_su') {
      await prisma.workflowHistory.create({ data: { tenantId, instanceId: instance.id, fromStep: 'cho_truong_phong', toStep: 'cho_nhan_su', action: 'approve', actorId: userMap['truongphong_dt'], comment: 'Đồng ý, chuyển phòng TCNS xác nhận phép còn lại' } });
    }
    if (s.step === 'cho_tai_chinh') {
      await prisma.workflowHistory.create({ data: { tenantId, instanceId: instance.id, fromStep: 'cho_truong_phong', toStep: 'cho_tai_chinh', action: 'approve', actorId: userMap['truongphong_dt'], comment: 'Phù hợp kế hoạch nghiên cứu khoa' } });
    }
    if (s.step === 'hoi_dong_xet_duyet') {
      await prisma.workflowHistory.create({ data: { tenantId, instanceId: instance.id, fromStep: 'nop_ho_so', toStep: 'hoi_dong_xet_duyet', action: 'start_review', actorId: userMap['admin'], comment: 'Hồ sơ đạt yêu cầu, chuyển hội đồng xét duyệt' } });
    }
    if (s.step === 'da_duyet') {
      await prisma.workflowHistory.create({ data: { tenantId, instanceId: instance.id, fromStep: config.initialState, toStep: 'da_duyet', action: 'approve', actorId: userMap['truongphong_dt'] } });
    }
    if (s.step === 'tu_choi') {
      await prisma.workflowHistory.create({ data: { tenantId, instanceId: instance.id, fromStep: config.initialState, toStep: 'tu_choi', action: 'reject', actorId: userMap['truongphong_dt'], comment: 'Không thể sắp xếp người thay thế trong thời gian nghỉ dài' } });
    }
    createdSubs++;
  }
  console.log(`\nTạo ${createdSubs} yêu cầu với quy trình`);

  // ---- 6. Delegations ----
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86400000);

  const delegations = [
    { from: 'truongphong_dt', to: 'truongphong_tcns', formIds: [] as string[], wfIds: [] as string[], note: 'TP Đào tạo ủy quyền TP TCNS toàn bộ (đi công tác)' },
    { from: 'truongphong_tcns', to: 'nhansu_linh', formIds: [formMap['Đơn xin nghỉ phép']], wfIds: [], note: 'TP TCNS ủy quyền CV Nhân sự duyệt nghỉ phép' },
    { from: 'truongphong_khtc', to: 'nhansu_nam', formIds: [], wfIds: [wfMap['Quy trình duyệt mua sắm']], note: 'TP KHTC ủy quyền duyệt mua sắm' },
  ];

  for (const d of delegations) {
    await prisma.delegation.create({
      data: { tenantId, fromUserId: userMap[d.from], toUserId: userMap[d.to], startDate: now, endDate: in30d, isActive: true,
        formIds: d.formIds.filter(Boolean), workflowDefinitionIds: d.wfIds.filter(Boolean) },
    });
    console.log(`Ủy quyền: ${d.note}`);
  }

  // ---- 7. Notifications ----
  const notifs = [
    { user: 'truongphong_dt', title: 'Đơn nghỉ phép mới', content: 'ThS. Hoàng Tiến Đức (Khoa CNTT) đã nộp đơn xin nghỉ phép 3 ngày', type: 'INFO' },
    { user: 'nhansu_linh', title: 'Chờ xác nhận nghỉ phép', content: 'Đơn nghỉ phép của ThS. Ngô Thanh Mai đã được Trưởng phòng duyệt, cần xác nhận', type: 'INFO' },
    { user: 'truongphong_dt', title: 'Đề tài NCKH chờ bỏ phiếu', content: 'Đề tài "Ứng dụng Deep Learning..." cần hội đồng bỏ phiếu (2/3 đồng ý)', type: 'INFO' },
    { user: 'chuyenvien_tuan', title: 'Đơn nghỉ phép đã duyệt', content: 'Đơn xin nghỉ tham dự lễ cưới em gái đã được phê duyệt', type: 'SUCCESS' },
    { user: 'giangvien_an', title: 'Đơn nghỉ phép bị từ chối', content: 'Đơn xin nghỉ 10 ngày du lịch bị từ chối: không sắp xếp được người thay thế', type: 'WARNING' },
    { user: 'truongphong_khtc', title: 'Đề xuất mua sắm cần duyệt', content: 'Đề xuất mua 2 máy chủ Dell PowerEdge (240 triệu VNĐ) cần xét duyệt tài chính', type: 'INFO' },
  ];

  for (const n of notifs) {
    await prisma.notification.create({
      data: { tenantId, userId: userMap[n.user], title: n.title, content: n.content, type: n.type, read: false },
    });
  }
  console.log(`Tạo ${notifs.length} thông báo`);

  // ---- 8. Settings ----
  const settings = [
    { key: 'ten_hoc_vien', value: 'Học viện Công nghệ Bưu chính Viễn thông' },
    { key: 'ten_viet_tat', value: 'PTIT' },
    { key: 'dia_chi', value: 'Km10, Đường Nguyễn Trãi, Hà Đông, Hà Nội' },
    { key: 'email_lien_he', value: 'admin@ptit.edu.vn' },
    { key: 'nam_hoc', value: '2025-2026' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { tenantId_key: { tenantId, key: s.key } },
      create: { tenantId, key: s.key, value: s.value },
      update: { value: s.value },
    });
  }
  console.log(`Tạo ${settings.length} cài đặt hệ thống`);

  // ---- Summary ----
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              FlowForm - Dữ liệu Học viện PTIT              ║
╠══════════════════════════════════════════════════════════════╣
║  Mật khẩu: ${PASSWORD}                                     ║
╠══════════════════════════════════════════════════════════════╣
║  TÀI KHOẢN                                                  ║
║  admin@ptit.edu.vn      ADMIN   Quản trị hệ thống          ║
║  pgs.truong@ptit.edu.vn MANAGER TP Đào tạo                 ║
║  ts.minh@ptit.edu.vn    MANAGER TP Tổ chức Nhân sự         ║
║  ths.hoa@ptit.edu.vn    MANAGER TP Kế hoạch Tài chính      ║
║  cv.linh@ptit.edu.vn    HR      CV Nhân sự                 ║
║  cv.nam@ptit.edu.vn     HR      CV Nhân sự                 ║
║  gv.duc@ptit.edu.vn     USER    GV Khoa CNTT               ║
║  gv.mai@ptit.edu.vn     USER    GV Khoa Viễn thông         ║
║  cv.tuan@ptit.edu.vn    USER    CV Phòng Đào tạo           ║
║  gv.an@ptit.edu.vn      USER    GV Khoa QTKD               ║
╠══════════════════════════════════════════════════════════════╣
║  BIỂU MẪU: 5                                                ║
║  QUY TRÌNH: 5 (tuần tự, song song, bỏ phiếu)               ║
║  YÊU CẦU: ${createdSubs} (đang xử lý + đã duyệt + từ chối)         ║
║  ỦY QUYỀN: 3 (có phân quyền theo form/workflow)            ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
