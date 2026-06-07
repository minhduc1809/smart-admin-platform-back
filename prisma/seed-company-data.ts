/**
 * Seed dữ liệu demo — Công ty Cổ phần Công nghệ TechVision (~150 nhân sự)
 *
 * Bao phủ toàn bộ chức năng của hệ thống:
 *  - 150 người dùng tên thật (1 ADMIN, 7 MANAGER, 4 HR, 138 USER) chia 7 phòng ban
 *  - 8 biểu mẫu dùng đủ 4 loại trường (text/number/date/select) + đủ rule validate
 *    (required, minLength, maxLength, min, max, regex, afterField cross-field)
 *  - 7 quy trình: tuần tự 1/2/3 bước, song song (PARALLEL_JOIN), bỏ phiếu (VOTING),
 *    SLA hours, requireComment, resubmitTargetState + 1 form không gắn quy trình
 *  - ~180 đơn nộp trải đều 15 ngày gần nhất (biểu đồ Dashboard theo ngày có dữ liệu)
 *    với đủ trạng thái: DRAFT / SUBMITTED / UNDER_REVIEW / APPROVED / REJECTED /
 *    RETURNED (kèm chuỗi nộp lại revision) / CANCELLED (withdraw)
 *  - Lịch sử workflow đầy đủ từng bước, có cả phê duyệt qua uỷ quyền (delegatedForId)
 *  - 3 uỷ quyền (toàn bộ / theo form / theo workflow), thông báo, job export, audit log
 *
 * Chạy:  npx ts-node prisma/seed-company-data.ts
 * Lưu ý: script XOÁ toàn bộ dữ liệu cũ của tenant "default" trước khi tạo mới.
 */
import {
  PrismaClient,
  Role,
  SubmissionStatus,
  WorkflowInstanceStatus,
  JobType,
  JobStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASSWORD = 'Test@12345';
const DOMAIN_EMAIL = 'techvision.vn';
const DAYS = 15; // số ngày trải dữ liệu submission

// ---------------------------------------------------------------------------
// PRNG có seed → dữ liệu sinh ra ổn định giữa các lần chạy
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260604);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function stripDiacritics(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// ---------------------------------------------------------------------------
// 1. Danh sách tên thật Việt Nam
// ---------------------------------------------------------------------------
const HO = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
  'Đinh',
  'Trịnh',
  'Mai',
  'Lương',
  'Tạ',
  'Châu',
  'Cao',
  'Hà',
];
const DEM_TEN_NAM = [
  'Minh Khoa',
  'Quang Huy',
  'Đức Anh',
  'Văn Long',
  'Hữu Phước',
  'Thanh Tùng',
  'Quốc Bảo',
  'Gia Huy',
  'Anh Tú',
  'Tuấn Kiệt',
  'Hoàng Nam',
  'Trung Hiếu',
  'Đình Phong',
  'Xuân Trường',
  'Thành Đạt',
  'Bá Khánh',
  'Ngọc Sơn',
  'Viết Hùng',
  'Công Vinh',
  'Nhật Minh',
  'Hải Đăng',
  'Đức Thịnh',
  'Văn Toàn',
  'Quang Vinh',
  'Mạnh Cường',
  'Tiến Dũng',
  'Hồng Quân',
  'Khắc Việt',
  'Duy Khánh',
  'Phúc Lâm',
  'Thái Sơn',
  'Văn Quyết',
  'Hữu Thắng',
  'Đăng Khoa',
  'Chí Trung',
  'Bảo Long',
];
const DEM_TEN_NU = [
  'Thu Hằng',
  'Ngọc Ánh',
  'Phương Linh',
  'Thanh Thảo',
  'Mỹ Duyên',
  'Khánh Vy',
  'Bảo Trân',
  'Thuỳ Dung',
  'Kim Ngân',
  'Hồng Nhung',
  'Quỳnh Anh',
  'Diệu Linh',
  'Thanh Hương',
  'Tường Vy',
  'Bích Phượng',
  'Hải Yến',
  'Lan Anh',
  'Minh Thư',
  'Trà My',
  'Cẩm Tú',
  'Thuý Hiền',
  'Ngọc Diệp',
  'Phương Thảo',
  'Mai Chi',
  'Thu Trang',
  'Hoài An',
  'Kiều Trinh',
  'Ánh Tuyết',
  'Yến Nhi',
  'Gia Hân',
  'Thanh Ngân',
  'Đan Lê',
  'Hạ Vy',
  'Tuệ Lâm',
  'Song Ngư',
  'Như Quỳnh',
];

// ---------------------------------------------------------------------------
// 2. Cơ cấu công ty: 7 phòng ban, 150 người
// ---------------------------------------------------------------------------
interface DeptDef {
  key: string;
  name: string;
  quota: number;
  manager: string;
}
const DEPTS: DeptDef[] = [
  { key: 'kythuat', name: 'Phòng Kỹ thuật', quota: 55, manager: 'gd.kythuat' },
  {
    key: 'kinhdoanh',
    name: 'Phòng Kinh doanh',
    quota: 25,
    manager: 'tp.kinhdoanh',
  },
  {
    key: 'marketing',
    name: 'Phòng Marketing',
    quota: 12,
    manager: 'tp.marketing',
  },
  {
    key: 'taichinh',
    name: 'Phòng Tài chính - Kế toán',
    quota: 10,
    manager: 'tp.taichinh',
  },
  { key: 'nhansu', name: 'Phòng Nhân sự', quota: 4, manager: 'tp.nhansu' },
  {
    key: 'sanpham',
    name: 'Phòng Sản phẩm & QA',
    quota: 18,
    manager: 'tp.sanpham',
  },
  {
    key: 'hanhchinh',
    name: 'Phòng Hành chính - IT',
    quota: 14,
    manager: 'tp.hanhchinh',
  },
];

interface NamedUser {
  username: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  dept: string;
  title: string;
}
const NAMED_USERS: NamedUser[] = [
  {
    username: 'admin',
    email: `admin@${DOMAIN_EMAIL}`,
    role: Role.ADMIN,
    firstName: 'Trần Quốc',
    lastName: 'Khánh',
    dept: 'bgd',
    title: 'Tổng Giám đốc',
  },
  {
    username: 'gd.kythuat',
    email: `hoang.lm@${DOMAIN_EMAIL}`,
    role: Role.MANAGER,
    firstName: 'Lê Minh',
    lastName: 'Hoàng',
    dept: 'kythuat',
    title: 'Giám đốc Kỹ thuật',
  },
  {
    username: 'tp.kinhdoanh',
    email: `tung.pt@${DOMAIN_EMAIL}`,
    role: Role.MANAGER,
    firstName: 'Phạm Thanh',
    lastName: 'Tùng',
    dept: 'kinhdoanh',
    title: 'Trưởng phòng Kinh doanh',
  },
  {
    username: 'tp.marketing',
    email: `anh.vn@${DOMAIN_EMAIL}`,
    role: Role.MANAGER,
    firstName: 'Vũ Ngọc',
    lastName: 'Ánh',
    dept: 'marketing',
    title: 'Trưởng phòng Marketing',
  },
  {
    username: 'tp.taichinh',
    email: `phuoc.dh@${DOMAIN_EMAIL}`,
    role: Role.MANAGER,
    firstName: 'Đặng Hữu',
    lastName: 'Phước',
    dept: 'taichinh',
    title: 'Trưởng phòng Tài chính - Kế toán',
  },
  {
    username: 'tp.nhansu',
    email: `huong.nt@${DOMAIN_EMAIL}`,
    role: Role.MANAGER,
    firstName: 'Ngô Thanh',
    lastName: 'Hương',
    dept: 'nhansu',
    title: 'Trưởng phòng Nhân sự',
  },
  {
    username: 'tp.sanpham',
    email: `ducanh.b@${DOMAIN_EMAIL}`,
    role: Role.MANAGER,
    firstName: 'Bùi Đức',
    lastName: 'Anh',
    dept: 'sanpham',
    title: 'Trưởng phòng Sản phẩm & QA',
  },
  {
    username: 'tp.hanhchinh',
    email: `truong.hx@${DOMAIN_EMAIL}`,
    role: Role.MANAGER,
    firstName: 'Hoàng Xuân',
    lastName: 'Trường',
    dept: 'hanhchinh',
    title: 'Trưởng phòng Hành chính - IT',
  },
  {
    username: 'hr.linh',
    email: `linh.np@${DOMAIN_EMAIL}`,
    role: Role.HR,
    firstName: 'Nguyễn Phương',
    lastName: 'Linh',
    dept: 'nhansu',
    title: 'Chuyên viên Nhân sự tổng hợp',
  },
  {
    username: 'hr.hang',
    email: `hang.tt@${DOMAIN_EMAIL}`,
    role: Role.HR,
    firstName: 'Trần Thu',
    lastName: 'Hằng',
    dept: 'nhansu',
    title: 'Chuyên viên Nhân sự',
  },
  {
    username: 'hr.vy',
    email: `vy.lk@${DOMAIN_EMAIL}`,
    role: Role.HR,
    firstName: 'Lê Khánh',
    lastName: 'Vy',
    dept: 'nhansu',
    title: 'Chuyên viên C&B',
  },
  {
    username: 'hr.thu',
    email: `thu.dm@${DOMAIN_EMAIL}`,
    role: Role.HR,
    firstName: 'Đỗ Minh',
    lastName: 'Thư',
    dept: 'nhansu',
    title: 'Chuyên viên Tuyển dụng',
  },
];

// ---------------------------------------------------------------------------
// 3. Bộ dữ liệu nội dung tiếng Việt cho submission
// ---------------------------------------------------------------------------
const LY_DO_NGHI = [
  'Về quê thăm gia đình, giải quyết việc gia đình tại Nghệ An',
  'Đưa con đi khám sức khỏe định kỳ tại Bệnh viện Nhi Trung ương',
  'Tham dự lễ cưới em trai tại Hải Phòng',
  'Khám sức khỏe tổng quát định kỳ hàng năm',
  'Giải quyết thủ tục hành chính đất đai tại quê',
  'Chăm sóc bố mẹ ốm nằm viện tại Bệnh viện Bạch Mai',
  'Nghỉ phép năm theo kế hoạch đã đăng ký từ đầu năm',
  'Tham dự họp phụ huynh và lễ tổng kết năm học của con',
  'Du lịch cùng gia đình theo kế hoạch nghỉ hè',
  'Sửa chữa nhà cửa trước mùa mưa bão',
];
const LY_DO_OT = [
  'Hoàn thiện tính năng thanh toán cho dự án E-Wallet trước ngày release',
  'Khắc phục sự cố production hệ thống khách hàng VIB',
  'Chuẩn bị tài liệu đấu thầu dự án chuyển đổi số tỉnh Quảng Ninh',
  'Hỗ trợ golive hệ thống CRM cho khách hàng vào cuối tuần',
  'Kiểm thử hồi quy bản phát hành v3.2 trước deadline',
  'Migration dữ liệu khách hàng sang hệ thống mới ngoài giờ hành chính',
  'Chốt số liệu báo cáo tài chính quý gửi ban lãnh đạo',
];
const DU_AN = [
  { label: 'Dự án E-Wallet VPay', value: 'vpay' },
  { label: 'Dự án CRM OmniSale', value: 'omnisale' },
  { label: 'Dự án Chuyển đổi số QN', value: 'Dự án Chuyển đổi số QN' },
  { label: 'Sản phẩm nội bộ TechHub', value: 'techhub' },
  { label: 'Vận hành - Bảo trì', value: 'maintenance' },
];
const MUC_DICH_TAM_UNG = [
  'Tạm ứng chi phí công tác gặp khách hàng tại Đà Nẵng',
  'Tạm ứng mua vật tư triển khai dự án tại site khách hàng',
  'Thanh toán chi phí tổ chức team building quý cho phòng',
  'Tạm ứng chi phí thuê gian hàng triển lãm Tech Expo 2026',
  'Thanh toán chi phí đào tạo chứng chỉ AWS cho nhóm DevOps',
  'Tạm ứng chi phí tiếp khách đối tác Nhật Bản',
];
const NGAN_HANG = [
  { label: 'Vietcombank', value: 'vcb' },
  { label: 'Techcombank', value: 'tcb' },
  { label: 'BIDV', value: 'bidv' },
  { label: 'MB Bank', value: 'mb' },
  { label: 'ACB', value: 'acb' },
];
const THIET_BI = [
  { ten: 'Laptop Dell Latitude 5440', gia: 28_000_000 },
  { ten: 'Màn hình LG UltraWide 34"', gia: 9_500_000 },
  { ten: 'Máy chủ Dell PowerEdge R750', gia: 185_000_000 },
  { ten: 'MacBook Pro 14" M4 cho team Mobile', gia: 52_000_000 },
  { ten: 'Bản quyền JetBrains All Products (10 user)', gia: 65_000_000 },
  { ten: 'Ghế công thái học Ergohuman', gia: 12_000_000 },
  { ten: 'Máy chiếu Epson EB-2250U phòng họp lớn', gia: 32_000_000 },
  { ten: 'Switch Cisco Catalyst 9300 48 port', gia: 95_000_000 },
  { ten: 'License Figma Organization (20 seat)', gia: 38_000_000 },
];
const MUC_DICH_MUA_SAM = [
  'Trang bị cho nhân sự mới onboard tháng tới của phòng',
  'Thay thế thiết bị đã hết khấu hao, hỏng hóc thường xuyên',
  'Phục vụ dự án mới ký với khách hàng, cần triển khai gấp',
  'Nâng cấp hạ tầng phòng họp phục vụ làm việc hybrid',
  'Bổ sung công cụ làm việc nâng cao năng suất của nhóm thiết kế',
];
const VI_TRI_TUYEN = [
  'Senior Backend Developer (NodeJS/NestJS)',
  'Frontend Developer (ReactJS)',
  'DevOps Engineer (AWS/K8s)',
  'Business Analyst',
  'Product Owner',
  'Tester / QA Engineer',
  'Nhân viên Kinh doanh phần mềm B2B',
  'UI/UX Designer',
  'Data Engineer',
];
const LY_DO_TUYEN = [
  'Bổ sung nhân lực cho dự án mới ký kết, hiện tại team đang quá tải',
  'Thay thế nhân sự nghỉ việc trong tháng, cần tuyển gấp để bàn giao',
  'Mở rộng team theo kế hoạch tăng trưởng đã duyệt đầu năm',
  'Xây dựng nhóm sản phẩm mới theo định hướng chiến lược của công ty',
];
const DIA_DIEM_CONG_TAC = [
  'Văn phòng khách hàng FPT Software - Đà Nẵng',
  'Trụ sở khách hàng VIB - TP. Hồ Chí Minh',
  'UBND tỉnh Quảng Ninh - Hạ Long',
  'Văn phòng đối tác NTT Data - Hà Nội',
  'Triển lãm Vietnam Tech Expo - SECC TP.HCM',
  'Data center Viettel IDC - Hòa Lạc',
];
const MUC_DICH_CONG_TAC = [
  'Khảo sát hiện trạng hệ thống và thu thập yêu cầu nghiệp vụ',
  'Triển khai golive và đào tạo người dùng cuối tại site khách hàng',
  'Họp kickoff dự án và ký kết hợp đồng giai đoạn 2',
  'Tham dự hội thảo công nghệ và kết nối đối tác tiềm năng',
  'Hỗ trợ kỹ thuật onsite xử lý sự cố hệ thống',
];
const NHAN_XET_THU_VIEC = [
  'Hoàn thành tốt các task được giao, chủ động học hỏi, hòa nhập nhanh với team',
  'Kỹ năng chuyên môn đạt yêu cầu, cần cải thiện thêm kỹ năng giao tiếp với khách hàng',
  'Vượt mong đợi, đã tự chủ được module quan trọng ngay trong thời gian thử việc',
  'Tiến độ hoàn thành công việc chưa ổn định, cần thêm thời gian đánh giá',
];
const GOP_Y_NOI_DUNG = [
  'Đề xuất bổ sung máy pha cà phê tại pantry tầng 5, hiện tại phải xuống tầng 3',
  'Điều hòa khu vực làm việc team QA quá lạnh, đề nghị điều chỉnh nhiệt độ',
  'Đề xuất tổ chức tech-talk định kỳ hàng tháng chia sẻ kiến thức giữa các team',
  'Wifi tầng 4 chập chờn vào giờ cao điểm, ảnh hưởng họp online với khách',
  'Đề xuất thêm lựa chọn ăn chay cho suất ăn trưa thứ 2 và thứ 6',
  'Bãi gửi xe quá tải vào buổi sáng, đề xuất làm việc với tòa nhà mở rộng khu vực',
];
const APPROVE_COMMENTS = [
  'Đồng ý phê duyệt',
  'Đã kiểm tra, hợp lệ. Duyệt',
  'OK, nhất trí',
  'Phù hợp kế hoạch, đồng ý',
  'Đã xác nhận thông tin, phê duyệt',
];
const REJECT_COMMENTS = [
  'Kinh phí vượt ngân sách quý hiện tại, đề nghị lùi sang quý sau',
  'Trùng với kế hoạch nghỉ của nhân sự khác trong nhóm, không thể sắp xếp',
  'Thông tin chưa đủ căn cứ phê duyệt, từ chối',
  'Chưa phù hợp với định hướng ưu tiên hiện tại của công ty',
  'Thời điểm đề xuất rơi vào giai đoạn cao điểm dự án, không thể duyệt',
];
const RETURN_COMMENTS = [
  'Bổ sung người bàn giao công việc trong thời gian vắng mặt',
  'Vui lòng điều chỉnh lại số ngày cho khớp với số phép còn lại',
  'Cần bổ sung báo giá của ít nhất 2 nhà cung cấp',
  'Làm rõ thêm mục đích sử dụng và đính kèm kế hoạch chi tiết',
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== TechVision — Seed dữ liệu công ty 150 nhân sự ===\n');
  const now = new Date();

  // ---- 1. Tenant ----
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'default' },
    create: { name: 'Công ty Cổ phần Công nghệ TechVision', domain: 'default' },
    update: { name: 'Công ty Cổ phần Công nghệ TechVision' },
  });
  const tenantId = tenant.id;
  console.log(`Tenant: ${tenant.name}`);

  // ---- 2. Xoá dữ liệu cũ của tenant (thứ tự FK) ----
  console.log('Dọn dữ liệu cũ của tenant...');
  await prisma.workflowHistory.deleteMany({ where: { tenantId } });
  await prisma.workflowInstance.deleteMany({ where: { tenantId } });
  await prisma.submission.deleteMany({ where: { tenantId } });
  await prisma.delegation.deleteMany({ where: { tenantId } });
  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.jobRecord.deleteMany({ where: { tenantId } });
  await prisma.fileRecord.deleteMany({ where: { tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.refreshToken.deleteMany({ where: { tenantId } });
  await prisma.workflowDefinition.deleteMany({ where: { tenantId } });
  await prisma.form.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });

  // ---- 3. Users: 150 người ----
  const hash = await bcrypt.hash(PASSWORD, 10);
  const userMap: Record<string, string> = {}; // username -> id
  const userDept: Record<string, string> = {}; // userId -> dept key
  const userFullName: Record<string, string> = {}; // userId -> họ tên

  for (const u of NAMED_USERS) {
    const created = await prisma.user.create({
      data: {
        tenantId,
        email: u.email,
        username: u.username,
        passwordHash: hash,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true,
        createdAt: addDays(now, -120),
      },
    });
    userMap[u.username] = created.id;
    userDept[created.id] = u.dept;
    userFullName[created.id] = `${u.firstName} ${u.lastName}`;
  }
  console.log(
    `Tạo ${NAMED_USERS.length} tài khoản chủ chốt (ADMIN/MANAGER/HR)`,
  );

  // Sinh 138 nhân viên USER với tên thật, chia theo phòng ban
  const usedEmails = new Set(NAMED_USERS.map((u) => u.email));
  const usedNames = new Set(
    NAMED_USERS.map((u) => `${u.firstName} ${u.lastName}`),
  );
  const staffByDept: Record<string, string[]> = {};
  let staffCount = 0;

  for (const dept of DEPTS) {
    staffByDept[dept.key] = staffByDept[dept.key] ?? [];
    for (let i = 0; i < dept.quota; i++) {
      // Sinh tên không trùng
      let ho = '',
        demTen = '',
        fullName = '';
      do {
        ho = pick(HO);
        demTen = chance(0.5) ? pick(DEM_TEN_NAM) : pick(DEM_TEN_NU);
        fullName = `${ho} ${demTen}`;
      } while (usedNames.has(fullName));
      usedNames.add(fullName);

      const demParts = demTen.split(' ');
      const lastName = demParts[demParts.length - 1]; // tên gọi
      const firstName = `${ho} ${demParts.slice(0, -1).join(' ')}`.trim(); // họ + đệm

      // Email: ten.<chữ cái đầu họ+đệm>@techvision.vn
      const initials = stripDiacritics(firstName)
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w[0])
        .join('');
      let local = `${stripDiacritics(lastName).toLowerCase()}.${initials}`;
      let email = `${local}@${DOMAIN_EMAIL}`;
      let n = 2;
      while (usedEmails.has(email)) {
        email = `${local}${n}@${DOMAIN_EMAIL}`;
        n++;
      }
      usedEmails.add(email);
      const username = email.split('@')[0];

      const created = await prisma.user.create({
        data: {
          tenantId,
          email,
          username,
          passwordHash: hash,
          role: Role.USER,
          firstName,
          lastName,
          isActive: true,
          createdAt: addDays(now, -randInt(30, 365)),
        },
      });
      userMap[username] = created.id;
      userDept[created.id] = dept.key;
      userFullName[created.id] = fullName;
      staffByDept[dept.key].push(created.id);
      staffCount++;
    }
  }
  console.log(
    `Tạo ${staffCount} nhân viên (USER) — tổng ${NAMED_USERS.length + staffCount} người\n`,
  );

  const adminId = userMap['admin'];
  const hrIds = ['hr.linh', 'hr.hang', 'hr.vy', 'hr.thu'].map(
    (u) => userMap[u],
  );
  const managerOfDept: Record<string, string> = {};
  for (const d of DEPTS) managerOfDept[d.key] = userMap[d.manager];
  const financeId = userMap['tp.taichinh'];
  const hanhChinhId = userMap['tp.hanhchinh'];
  const hrManagerId = userMap['tp.nhansu'];
  const allManagerIds = DEPTS.map((d) => userMap[d.manager]);
  const allStaffIds = Object.values(staffByDept).flat();

  // ---- 4. Forms: 8 biểu mẫu (đủ loại trường + rule validate) ----
  const formDefs: Array<{
    key: string;
    name: string;
    description: string;
    schema: any;
    settings: any;
  }> = [
    {
      key: 'nghi-phep',
      name: 'Đơn xin nghỉ phép',
      description:
        'Đăng ký nghỉ phép năm, nghỉ ốm, nghỉ việc riêng theo quy định công ty',
      settings: { theme: 'default', allowAnonymous: false },
      schema: {
        formId: 'nghi-phep',
        fields: [
          {
            key: 'loaiNghi',
            label: 'Loại nghỉ phép',
            type: 'select',
            rules: { required: true },
            options: [
              { label: 'Nghỉ phép năm', value: 'Phép năm' },
              { label: 'Nghỉ ốm (có BHXH)', value: 'Nghỉ ốm' },
              { label: 'Nghỉ việc riêng không lương', value: 'Không lương' },
              { label: 'Nghỉ chế độ (cưới, tang, thai sản)', value: 'Nghỉ chế độ' },
            ],
          },
          {
            key: 'ngayBatDau',
            label: 'Ngày bắt đầu nghỉ',
            type: 'date',
            rules: { required: true },
          },
          {
            key: 'soNgay',
            label: 'Số ngày nghỉ',
            type: 'number',
            rules: { required: true, min: 0.5, max: 30 },
          },
          {
            key: 'lyDo',
            label: 'Lý do nghỉ',
            type: 'text',
            rules: { required: true, minLength: 10, maxLength: 500 },
          },
          {
            key: 'nguoiBanGiao',
            label: 'Người bàn giao công việc',
            type: 'text',
            rules: { required: true },
          },
        ],
      },
    },
    {
      key: 'lam-them-gio',
      name: 'Đăng ký làm thêm giờ',
      description: 'Đăng ký OT có tính lương theo quy chế, tối đa 4 giờ/ngày',
      settings: { theme: 'mint', allowAnonymous: false },
      schema: {
        formId: 'lam-them-gio',
        fields: [
          {
            key: 'ngayLamThem',
            label: 'Ngày làm thêm',
            type: 'date',
            rules: { required: true },
          },
          {
            key: 'soGio',
            label: 'Số giờ OT',
            type: 'number',
            rules: { required: true, min: 1, max: 4 },
          },
          {
            key: 'duAn',
            label: 'Dự án',
            type: 'select',
            rules: { required: true },
            options: DU_AN,
          },
          {
            key: 'noiDungCongViec',
            label: 'Nội dung công việc',
            type: 'text',
            rules: { required: true, minLength: 15 },
          },
        ],
      },
    },
    {
      key: 'tam-ung',
      name: 'Đề nghị tạm ứng / thanh toán',
      description:
        'Tạm ứng chi phí công tác, dự án, thanh toán chi phí phát sinh',
      settings: { theme: 'sunset', allowAnonymous: false },
      schema: {
        formId: 'tam-ung',
        fields: [
          {
            key: 'soTien',
            label: 'Số tiền (VNĐ)',
            type: 'number',
            rules: { required: true, min: 100000, max: 500000000 },
          },
          {
            key: 'mucDich',
            label: 'Mục đích sử dụng',
            type: 'text',
            rules: { required: true, minLength: 15 },
          },
          {
            key: 'soTaiKhoan',
            label: 'Số tài khoản nhận',
            type: 'text',
            rules: { required: true, regex: '^[0-9]{8,16}$' },
          },
          {
            key: 'nganHang',
            label: 'Ngân hàng',
            type: 'select',
            rules: { required: true },
            options: NGAN_HANG,
          },
        ],
      },
    },
    {
      key: 'mua-sam',
      name: 'Đề xuất mua sắm thiết bị',
      description:
        'Đề xuất mua sắm thiết bị, phần mềm, vật tư — duyệt song song Quản lý + Tài chính',
      settings: { theme: 'dark', allowAnonymous: false },
      schema: {
        formId: 'mua-sam',
        fields: [
          {
            key: 'tenThietBi',
            label: 'Tên thiết bị / phần mềm',
            type: 'text',
            rules: { required: true },
          },
          {
            key: 'soLuong',
            label: 'Số lượng',
            type: 'number',
            rules: { required: true, min: 1, max: 100 },
          },
          {
            key: 'donGia',
            label: 'Đơn giá dự kiến (VNĐ)',
            type: 'number',
            rules: { required: true, min: 0 },
          },
          {
            key: 'mucDich',
            label: 'Mục đích sử dụng',
            type: 'text',
            rules: { required: true, minLength: 15 },
          },
          {
            key: 'mucDoUuTien',
            label: 'Mức độ ưu tiên',
            type: 'select',
            rules: { required: true },
            options: [
              { label: 'Bình thường', value: 'Bình thường' },
              { label: 'Cấp bách', value: 'Cấp bách' },
              { label: 'Khẩn cấp', value: 'Khẩn cấp' },
            ],
          },
        ],
      },
    },
    {
      key: 'tuyen-dung',
      name: 'Đề xuất tuyển dụng nhân sự',
      description:
        'Đề xuất mở vị trí tuyển dụng mới — Ban lãnh đạo bỏ phiếu (cần 2 phiếu đồng ý)',
      settings: { theme: 'violet', allowAnonymous: false },
      schema: {
        formId: 'tuyen-dung',
        fields: [
          {
            key: 'viTri',
            label: 'Vị trí tuyển dụng',
            type: 'text',
            rules: { required: true, minLength: 5 },
          },
          {
            key: 'soLuong',
            label: 'Số lượng cần tuyển',
            type: 'number',
            rules: { required: true, min: 1, max: 20 },
          },
          {
            key: 'phongBan',
            label: 'Phòng ban',
            type: 'select',
            rules: { required: true },
            options: DEPTS.map((d) => ({ label: d.name, value: d.key })),
          },
          {
            key: 'loaiHopDong',
            label: 'Loại hợp đồng',
            type: 'select',
            rules: { required: true },
            options: [
              { label: 'Toàn thời gian', value: 'fulltime' },
              { label: 'Bán thời gian', value: 'parttime' },
              { label: 'Cộng tác viên / Thời vụ', value: 'ctv' },
            ],
          },
          {
            key: 'lyDoTuyen',
            label: 'Lý do tuyển dụng',
            type: 'text',
            rules: { required: true, minLength: 20 },
          },
        ],
      },
    },
    {
      key: 'cong-tac',
      name: 'Đăng ký công tác',
      description:
        'Đăng ký đi công tác, gặp khách hàng, sự kiện bên ngoài công ty',
      settings: { theme: 'default', allowAnonymous: false },
      schema: {
        formId: 'cong-tac',
        fields: [
          {
            key: 'diaDiem',
            label: 'Địa điểm công tác',
            type: 'text',
            rules: { required: true },
          },
          {
            key: 'mucDich',
            label: 'Mục đích công tác',
            type: 'text',
            rules: { required: true, minLength: 10 },
          },
          {
            key: 'ngayDi',
            label: 'Ngày đi',
            type: 'date',
            rules: { required: true },
          },
          {
            key: 'ngayVe',
            label: 'Ngày về',
            type: 'date',
            rules: { required: true, afterField: 'ngayDi' },
          },
          {
            key: 'phuongTien',
            label: 'Phương tiện',
            type: 'select',
            rules: { required: true },
            options: [
              { label: 'Máy bay', value: 'Máy bay' },
              { label: 'Tàu hỏa', value: 'tau' },
              { label: 'Xe công ty', value: 'Xe công ty' },
              { label: 'Tự túc (có hỗ trợ xăng xe)', value: 'Tự túc' },
            ],
          },
          {
            key: 'kinhPhiDuKien',
            label: 'Kinh phí dự kiến (VNĐ)',
            type: 'number',
            rules: { required: true, min: 0 },
          },
        ],
      },
    },
    {
      key: 'thu-viec',
      name: 'Đánh giá kết quả thử việc',
      description:
        'HR khởi tạo đánh giá nhân viên hết hạn thử việc — Quản lý đánh giá, HR xác nhận',
      settings: { theme: 'mint', allowAnonymous: false },
      schema: {
        formId: 'thu-viec',
        fields: [
          {
            key: 'tenNhanVien',
            label: 'Họ tên nhân viên thử việc',
            type: 'text',
            rules: { required: true },
          },
          {
            key: 'viTri',
            label: 'Vị trí',
            type: 'text',
            rules: { required: true },
          },
          {
            key: 'ngayKetThucThuViec',
            label: 'Ngày kết thúc thử việc',
            type: 'date',
            rules: { required: true },
          },
          {
            key: 'diemDanhGia',
            label: 'Điểm đánh giá tổng hợp (1-10)',
            type: 'number',
            rules: { required: true, min: 1, max: 10 },
          },
          {
            key: 'ketQua',
            label: 'Kết quả đề xuất',
            type: 'select',
            rules: { required: true },
            options: [
              { label: 'Đạt — ký HĐLĐ chính thức', value: 'Đạt' },
              { label: 'Gia hạn thử việc thêm 1 tháng', value: 'Gia hạn thử việc' },
              { label: 'Không đạt — kết thúc hợp đồng', value: 'Không đạt' },
            ],
          },
          {
            key: 'nhanXet',
            label: 'Nhận xét chi tiết',
            type: 'text',
            rules: { required: true, minLength: 30 },
          },
        ],
      },
    },
    {
      key: 'gop-y',
      name: 'Góp ý cải tiến nội bộ',
      description:
        'Hòm thư góp ý môi trường làm việc, quy trình, phúc lợi (không cần phê duyệt)',
      settings: { theme: 'default', allowAnonymous: true },
      schema: {
        formId: 'gop-y',
        fields: [
          {
            key: 'chuDe',
            label: 'Chủ đề',
            type: 'select',
            rules: { required: true },
            options: [
              { label: 'Môi trường làm việc', value: 'Môi trường làm việc' },
              { label: 'Quy trình - công cụ', value: 'Quy trình - công cụ' },
              { label: 'Phúc lợi - văn hóa', value: 'Phúc lợi - văn hóa' },
              { label: 'Khác', value: 'Khác' },
            ],
          },
          {
            key: 'noiDung',
            label: 'Nội dung góp ý',
            type: 'text',
            rules: { required: true, minLength: 20, maxLength: 1000 },
          },
        ],
      },
    },
  ];

  const formMap: Record<string, string> = {};
  for (const f of formDefs) {
    const created = await prisma.form.create({
      data: {
        tenantId,
        name: f.name,
        description: f.description,
        schema: f.schema,
        settings: f.settings,
        isActive: true,
        createdBy: adminId,
        createdAt: addDays(now, -60),
      },
    });
    formMap[f.key] = created.id;
    console.log(`Biểu mẫu: ${f.name}`);
  }

  // ---- 5. Workflow definitions: 7 quy trình ----
  const requireComment = { requireComment: true };

  const wfConfigs: Record<
    string,
    { name: string; formKey: string; config: any }
  > = {
    'nghi-phep': {
      name: 'Quy trình duyệt nghỉ phép (Quản lý → Nhân sự)',
      formKey: 'nghi-phep',
      config: {
        states: [
          'Chờ quản lý duyệt',
          'Chờ nhân sự duyệt',
          'Đã duyệt',
          'Từ chối',
          'Trả lại',
        ],
        initialState: 'Chờ quản lý duyệt',
        finalStates: ['Đã duyệt', 'Từ chối', 'Trả lại'],
        transitions: [
          {
            from: 'Chờ quản lý duyệt',
            to: 'Chờ nhân sự duyệt',
            action: 'approve',
            roles: ['MANAGER', 'ADMIN'],
          },
          {
            from: 'Chờ quản lý duyệt',
            to: 'Từ chối',
            action: 'reject',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Chờ quản lý duyệt',
            to: 'Trả lại',
            action: 'return_for_edit',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Chờ nhân sự duyệt',
            to: 'Đã duyệt',
            action: 'approve',
            roles: ['HR', 'ADMIN'],
          },
          {
            from: 'Chờ nhân sự duyệt',
            to: 'Từ chối',
            action: 'reject',
            roles: ['HR', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Chờ nhân sự duyệt',
            to: 'Trả lại',
            action: 'return_for_edit',
            roles: ['HR', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Trả lại',
            to: 'Chờ quản lý duyệt',
            action: 'resubmit',
            roles: ['USER', 'HR', 'MANAGER', 'ADMIN'],
          },
        ],
        statusMapping: {
          da_duyet: 'APPROVED',
          tu_choi: 'REJECTED',
          tra_lai: 'RETURNED',
        },
        resubmitTargetState: 'Chờ quản lý duyệt',
        statesDetails: {
          cho_quan_ly: { label: 'Chờ Quản lý duyệt', slaHours: 24 },
          cho_nhan_su: { label: 'Chờ Nhân sự xác nhận', slaHours: 48 },
        },
      },
    },
    'lam-them-gio': {
      name: 'Quy trình duyệt làm thêm giờ (1 bước)',
      formKey: 'lam-them-gio',
      config: {
        states: ['Chờ quản lý duyệt', 'Đã duyệt', 'Từ chối'],
        initialState: 'Chờ quản lý duyệt',
        finalStates: ['Đã duyệt', 'Từ chối'],
        transitions: [
          {
            from: 'Chờ quản lý duyệt',
            to: 'Đã duyệt',
            action: 'approve',
            roles: ['MANAGER', 'ADMIN'],
          },
          {
            from: 'Chờ quản lý duyệt',
            to: 'Từ chối',
            action: 'reject',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
        ],
        statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
        statesDetails: {
          cho_quan_ly: { label: 'Chờ Quản lý duyệt OT', slaHours: 24 },
        },
      },
    },
    'tam-ung': {
      name: 'Quy trình tạm ứng (Quản lý → Tài chính)',
      formKey: 'tam-ung',
      config: {
        states: [
          'Chờ quản lý duyệt',
          'Chờ tài chính duyệt',
          'Đã duyệt',
          'Từ chối',
          'Trả lại',
        ],
        initialState: 'Chờ quản lý duyệt',
        finalStates: ['Đã duyệt', 'Từ chối', 'Trả lại'],
        transitions: [
          {
            from: 'Chờ quản lý duyệt',
            to: 'Chờ tài chính duyệt',
            action: 'approve',
            roles: ['MANAGER', 'ADMIN'],
          },
          {
            from: 'Chờ quản lý duyệt',
            to: 'Từ chối',
            action: 'reject',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Chờ quản lý duyệt',
            to: 'Trả lại',
            action: 'return_for_edit',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Chờ tài chính duyệt',
            to: 'Đã duyệt',
            action: 'approve',
            roles: ['MANAGER', 'ADMIN'],
          },
          {
            from: 'Chờ tài chính duyệt',
            to: 'Từ chối',
            action: 'reject',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Trả lại',
            to: 'Chờ quản lý duyệt',
            action: 'resubmit',
            roles: ['USER', 'HR', 'MANAGER', 'ADMIN'],
          },
        ],
        statusMapping: {
          da_duyet: 'APPROVED',
          tu_choi: 'REJECTED',
          tra_lai: 'RETURNED',
        },
        resubmitTargetState: 'Chờ quản lý duyệt',
        statesDetails: {
          cho_quan_ly: { label: 'Chờ Quản lý duyệt', slaHours: 24 },
          cho_tai_chinh: { label: 'Chờ Tài chính duyệt chi', slaHours: 48 },
        },
      },
    },
    'mua-sam': {
      name: 'Quy trình mua sắm (duyệt song song Quản lý + Tài chính)',
      formKey: 'mua-sam',
      config: {
        states: ['Chờ duyệt', 'Đã duyệt', 'Từ chối'],
        initialState: 'Chờ duyệt',
        finalStates: ['Đã duyệt', 'Từ chối'],
        transitions: [
          {
            from: 'Chờ duyệt',
            to: 'Đã duyệt',
            action: 'Quản lý phê duyệt',
            roles: ['MANAGER', 'ADMIN'],
            type: 'PARALLEL_JOIN',
            requireActions: ['Quản lý phê duyệt', 'Tài chính phê duyệt'],
          },
          {
            from: 'Chờ duyệt',
            to: 'Từ chối',
            action: 'reject',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
        ],
        statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
        statesDetails: {
          cho_duyet: {
            label: 'Chờ duyệt song song (Quản lý + Tài chính)',
            slaHours: 72,
          },
        },
      },
    },
    'tuyen-dung': {
      name: 'Quy trình tuyển dụng (Ban lãnh đạo bỏ phiếu 2 phiếu thuận)',
      formKey: 'tuyen-dung',
      config: {
        states: ['Đề xuất', 'Bỏ phiếu hội đồng', 'Đã duyệt', 'Từ chối'],
        initialState: 'Đề xuất',
        finalStates: ['Đã duyệt', 'Từ chối'],
        transitions: [
          {
            from: 'Đề xuất',
            to: 'Bỏ phiếu hội đồng',
            action: 'Bắt đầu xem xét',
            roles: ['HR', 'MANAGER', 'ADMIN'],
          },
          {
            from: 'Bỏ phiếu hội đồng',
            to: 'Đã duyệt',
            action: 'vote_approve',
            roles: ['MANAGER', 'ADMIN'],
            type: 'VOTING',
            votingConfig: {
              approveAction: 'vote_approve',
              rejectAction: 'vote_reject',
              approveThreshold: 2,
              rejectThreshold: 2,
              approveTarget: 'Đã duyệt',
              rejectTarget: 'Từ chối',
            },
          },
        ],
        statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
        statesDetails: {
          de_xuat: { label: 'HR thẩm định hồ sơ', slaHours: 24 },
          bo_phieu: { label: 'Ban lãnh đạo bỏ phiếu', slaHours: 120 },
        },
      },
    },
    'cong-tac': {
      name: 'Quy trình công tác (Quản lý → Hành chính)',
      formKey: 'cong-tac',
      config: {
        states: ['Chờ quản lý duyệt', 'Chờ hành chính duyệt', 'Đã duyệt', 'Từ chối'],
        initialState: 'Chờ quản lý duyệt',
        finalStates: ['Đã duyệt', 'Từ chối'],
        transitions: [
          {
            from: 'Chờ quản lý duyệt',
            to: 'Chờ hành chính duyệt',
            action: 'approve',
            roles: ['MANAGER', 'ADMIN'],
          },
          {
            from: 'Chờ quản lý duyệt',
            to: 'Từ chối',
            action: 'reject',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Chờ hành chính duyệt',
            to: 'Đã duyệt',
            action: 'approve',
            roles: ['MANAGER', 'ADMIN'],
          },
          {
            from: 'Chờ hành chính duyệt',
            to: 'Từ chối',
            action: 'reject',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
        ],
        statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
        statesDetails: {
          cho_quan_ly: { label: 'Chờ Quản lý duyệt', slaHours: 24 },
          cho_hanh_chinh: {
            label: 'Hành chính thu xếp phương tiện/lưu trú',
            slaHours: 48,
          },
        },
      },
    },
    'thu-viec': {
      name: 'Quy trình đánh giá thử việc (Quản lý → Nhân sự)',
      formKey: 'thu-viec',
      config: {
        states: [
          'Chờ quản lý đánh giá',
          'Chờ nhân sự xác nhận',
          'Đã duyệt',
          'Từ chối',
        ],
        initialState: 'Chờ quản lý đánh giá',
        finalStates: ['Đã duyệt', 'Từ chối'],
        transitions: [
          {
            from: 'Chờ quản lý đánh giá',
            to: 'Chờ nhân sự xác nhận',
            action: 'approve',
            roles: ['MANAGER', 'ADMIN'],
          },
          {
            from: 'Chờ quản lý đánh giá',
            to: 'Từ chối',
            action: 'reject',
            roles: ['MANAGER', 'ADMIN'],
            conditions: requireComment,
          },
          {
            from: 'Chờ nhân sự xác nhận',
            to: 'Đã duyệt',
            action: 'approve',
            roles: ['HR', 'ADMIN'],
          },
          {
            from: 'Chờ nhân sự xác nhận',
            to: 'Từ chối',
            action: 'reject',
            roles: ['HR', 'ADMIN'],
            conditions: requireComment,
          },
        ],
        statusMapping: { da_duyet: 'APPROVED', tu_choi: 'REJECTED' },
        statesDetails: {
          cho_quan_ly_danh_gia: {
            label: 'Quản lý trực tiếp đánh giá',
            slaHours: 48,
          },
          cho_nhan_su_xac_nhan: {
            label: 'Nhân sự xác nhận & làm hợp đồng',
            slaHours: 24,
          },
        },
      },
    },
  };

  const wfMap: Record<string, string> = {}; // formKey -> wf definition id
  for (const [key, wf] of Object.entries(wfConfigs)) {
    const created = await prisma.workflowDefinition.create({
      data: {
        tenantId,
        name: wf.name,
        formId: formMap[wf.formKey],
        config: wf.config,
        createdBy: adminId,
        createdAt: addDays(now, -60),
      },
    });
    wfMap[key] = created.id;
    console.log(`Quy trình: ${wf.name}`);
  }

  // ---- 6. Delegations (tạo trước để dùng trong history) ----
  // 6a. TP Kinh doanh đi công tác Nhật 1 tháng → uỷ quyền toàn bộ cho GĐ Kỹ thuật
  const delegSale = await prisma.delegation.create({
    data: {
      tenantId,
      fromUserId: userMap['tp.kinhdoanh'],
      toUserId: userMap['gd.kythuat'],
      startDate: addDays(now, -20),
      endDate: addDays(now, 10),
      isActive: true,
      formIds: [],
      workflowDefinitionIds: [],
    },
  });
  // 6b. TP Nhân sự uỷ quyền duyệt nghỉ phép cho CV Nhân sự Linh (theo form)
  await prisma.delegation.create({
    data: {
      tenantId,
      fromUserId: hrManagerId,
      toUserId: userMap['hr.linh'],
      startDate: addDays(now, -10),
      endDate: addDays(now, 20),
      isActive: true,
      formIds: [formMap['nghi-phep']],
      workflowDefinitionIds: [],
    },
  });
  // 6c. TP Tài chính uỷ quyền duyệt mua sắm cho TP Hành chính (theo workflow)
  await prisma.delegation.create({
    data: {
      tenantId,
      fromUserId: financeId,
      toUserId: hanhChinhId,
      startDate: addDays(now, -5),
      endDate: addDays(now, 25),
      isActive: true,
      formIds: [],
      workflowDefinitionIds: [wfMap['mua-sam']],
    },
  });
  console.log('Tạo 3 uỷ quyền (toàn bộ / theo biểu mẫu / theo quy trình)\n');

  // ---- 7. Sinh dữ liệu submission cho từng form ----
  const submitterPool = [...allStaffIds, ...hrIds]; // USER + HR đều nộp đơn

  function deptManagerOf(submitterId: string): string {
    const dept = userDept[submitterId] ?? 'kythuat';
    return managerOfDept[dept] ?? adminId;
  }
  /** Quản lý bước 1: nếu TP Kinh doanh thì 35% duyệt qua uỷ quyền bởi GĐ Kỹ thuật */
  function step1Approver(submitterId: string): {
    actorId: string;
    delegatedForId?: string;
  } {
    const mgr = deptManagerOf(submitterId);
    if (mgr === userMap['tp.kinhdoanh'] && chance(0.35)) {
      return {
        actorId: userMap['gd.kythuat'],
        delegatedForId: userMap['tp.kinhdoanh'],
      };
    }
    return { actorId: mgr };
  }
  const randomColleague = (excludeId: string) => {
    let id = excludeId;
    while (id === excludeId) id = pick(allStaffIds);
    return userFullName[id];
  };

  // Sinh data theo form
  function genFormData(
    formKey: string,
    submitterId: string,
    createdAt: Date,
  ): any {
    switch (formKey) {
      case 'nghi-phep':
        return {
          loaiNghi: pick([
            'Phép năm',
            'Phép năm',
            'Phép năm',
            'Nghỉ ốm',
            'Không lương',
            'Nghỉ chế độ',
          ]),
          ngayBatDau: isoDate(addDays(createdAt, randInt(3, 21))),
          soNgay: pick([0.5, 1, 1, 2, 2, 3, 5]),
          lyDo: pick(LY_DO_NGHI),
          nguoiBanGiao: randomColleague(submitterId),
        };
      case 'lam-them-gio':
        return {
          ngayLamThem: isoDate(addDays(createdAt, randInt(1, 7))),
          soGio: randInt(1, 4),
          duAn: pick(DU_AN).value,
          noiDungCongViec: pick(LY_DO_OT),
        };
      case 'tam-ung':
        return {
          soTien: randInt(2, 80) * 500_000,
          mucDich: pick(MUC_DICH_TAM_UNG),
          soTaiKhoan:
            String(randInt(10000000, 99999999)) + String(randInt(1000, 9999)),
          nganHang: pick(NGAN_HANG).value,
        };
      case 'mua-sam': {
        const tb = pick(THIET_BI);
        return {
          tenThietBi: tb.ten,
          soLuong: randInt(1, 10),
          donGia: tb.gia,
          mucDich: pick(MUC_DICH_MUA_SAM),
          mucDoUuTien: pick([
            'Bình thường',
            'Bình thường',
            'Cấp bách',
            'Khẩn cấp',
          ]),
        };
      }
      case 'tuyen-dung':
        return {
          viTri: pick(VI_TRI_TUYEN),
          soLuong: randInt(1, 5),
          phongBan: pick(DEPTS).key,
          loaiHopDong: pick([
            'fulltime',
            'fulltime',
            'fulltime',
            'parttime',
            'ctv',
          ]),
          lyDoTuyen: pick(LY_DO_TUYEN),
        };
      case 'cong-tac': {
        const ngayDi = addDays(createdAt, randInt(5, 20));
        return {
          diaDiem: pick(DIA_DIEM_CONG_TAC),
          mucDich: pick(MUC_DICH_CONG_TAC),
          ngayDi: isoDate(ngayDi),
          ngayVe: isoDate(addDays(ngayDi, randInt(1, 5))),
          phuongTien: pick(['Máy bay', 'tau', 'Xe công ty', 'Tự túc']),
          kinhPhiDuKien: randInt(2, 30) * 500_000,
        };
      }
      case 'thu-viec':
        return {
          tenNhanVien: randomColleague(submitterId),
          viTri: pick(VI_TRI_TUYEN),
          ngayKetThucThuViec: isoDate(addDays(createdAt, randInt(3, 14))),
          diemDanhGia: randInt(5, 10),
          ketQua: pick(['Đạt', 'Đạt', 'Đạt', 'Gia hạn thử việc', 'Không đạt']),
          nhanXet: pick(NHAN_XET_THU_VIEC),
        };
      case 'gop-y':
        return {
          chuDe: pick(['Môi trường làm việc', 'Quy trình - công cụ', 'Phúc lợi - văn hóa', 'Khác']),
          noiDung: pick(GOP_Y_NOI_DUNG),
        };
      default:
        return {};
    }
  }

  type HistStep = {
    fromStep: string | null;
    toStep: string;
    action: string;
    actorId: string;
    comment?: string;
    delegatedForId?: string;
  };
  interface Trajectory {
    status: SubmissionStatus;
    currentStep: string;
    instanceStatus: WorkflowInstanceStatus | null; // null = DRAFT, không tạo instance
    steps: HistStep[]; // không gồm bản ghi SUBMIT
    canRevise?: boolean; // RETURNED → có thể sinh bản nộp lại
  }

  /** Chọn kịch bản theo form & độ tuổi đơn (ageDays: 0 = hôm nay) */
  function buildTrajectory(
    formKey: string,
    submitterId: string,
    ageDays: number,
  ): Trajectory | null {
    const cfg = wfConfigs[formKey]?.config;
    const isOld = ageDays >= 5;
    const isMid = ageDays >= 2 && ageDays < 5;

    // Trọng số kịch bản: [old, mid, new]
    const w = (old_: number, mid: number, neu: number) =>
      isOld ? old_ : isMid ? mid : neu;
    const roll = rand() * 100;

    const s1 = step1Approver(submitterId);
    const hrApprover = pick(hrIds);
    const approveC = () => (chance(0.6) ? pick(APPROVE_COMMENTS) : undefined);

    switch (formKey) {
      case 'gop-y':
        // Không có workflow → SUBMITTED (5% DRAFT)
        return chance(0.07)
          ? {
              status: SubmissionStatus.DRAFT,
              currentStep: '',
              instanceStatus: null,
              steps: [],
            }
          : {
              status: SubmissionStatus.SUBMITTED,
              currentStep: '',
              instanceStatus: null,
              steps: [],
            };

      case 'nghi-phep':
      case 'thu-viec': {
        const st1 = cfg.initialState as string;
        const st2 =
          formKey === 'nghi-phep' ? 'Chờ nhân sự duyệt' : 'Chờ nhân sự xác nhận';
        const step2Actor = hrApprover;
        // DRAFT 4%
        if (roll < 4)
          return {
            status: SubmissionStatus.DRAFT,
            currentStep: '',
            instanceStatus: null,
            steps: [],
          };
        // APPROVED
        if (roll < 4 + w(52, 30, 10)) {
          return {
            status: SubmissionStatus.APPROVED,
            currentStep: 'Đã duyệt',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            steps: [
              {
                fromStep: st1,
                toStep: st2,
                action: 'approve',
                actorId: s1.actorId,
                comment: approveC(),
                delegatedForId: s1.delegatedForId,
              },
              {
                fromStep: st2,
                toStep: 'Đã duyệt',
                action: 'approve',
                actorId: step2Actor,
                comment: approveC(),
              },
            ],
          };
        }
        // REJECTED (bước 1 hoặc bước 2)
        if (roll < 4 + w(52, 30, 10) + w(14, 10, 4)) {
          return chance(0.5)
            ? {
                status: SubmissionStatus.REJECTED,
                currentStep: 'Từ chối',
                instanceStatus: WorkflowInstanceStatus.COMPLETED,
                steps: [
                  {
                    fromStep: st1,
                    toStep: 'Từ chối',
                    action: 'reject',
                    actorId: s1.actorId,
                    comment: pick(REJECT_COMMENTS),
                    delegatedForId: s1.delegatedForId,
                  },
                ],
              }
            : {
                status: SubmissionStatus.REJECTED,
                currentStep: 'Từ chối',
                instanceStatus: WorkflowInstanceStatus.COMPLETED,
                steps: [
                  {
                    fromStep: st1,
                    toStep: st2,
                    action: 'approve',
                    actorId: s1.actorId,
                    comment: approveC(),
                    delegatedForId: s1.delegatedForId,
                  },
                  {
                    fromStep: st2,
                    toStep: 'Từ chối',
                    action: 'reject',
                    actorId: step2Actor,
                    comment: pick(REJECT_COMMENTS),
                  },
                ],
              };
        }
        // RETURNED (chỉ nghỉ phép có tra_lai)
        if (
          formKey === 'nghi-phep' &&
          roll < 4 + w(52, 30, 10) + w(14, 10, 4) + w(10, 8, 4)
        ) {
          return {
            status: SubmissionStatus.RETURNED,
            currentStep: 'Trả lại',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            canRevise: true,
            steps: [
              {
                fromStep: st1,
                toStep: 'Trả lại',
                action: 'return_for_edit',
                actorId: s1.actorId,
                comment: pick(RETURN_COMMENTS),
                delegatedForId: s1.delegatedForId,
              },
            ],
          };
        }
        // CANCELLED (rút đơn) 4%
        if (roll < 4 + w(52, 30, 10) + w(14, 10, 4) + w(10, 8, 4) + 4) {
          return {
            status: SubmissionStatus.CANCELLED,
            currentStep: st1,
            instanceStatus: WorkflowInstanceStatus.CANCELLED,
            steps: [
              {
                fromStep: st1,
                toStep: st1,
                action: 'withdraw',
                actorId: submitterId,
                comment: 'Tôi xin rút đơn do thay đổi kế hoạch cá nhân',
              },
            ],
          };
        }
        // ACTIVE: 50/50 đang ở bước 1 / bước 2
        return chance(0.5)
          ? {
              status: SubmissionStatus.UNDER_REVIEW,
              currentStep: st1,
              instanceStatus: WorkflowInstanceStatus.ACTIVE,
              steps: [],
            }
          : {
              status: SubmissionStatus.UNDER_REVIEW,
              currentStep: st2,
              instanceStatus: WorkflowInstanceStatus.ACTIVE,
              steps: [
                {
                  fromStep: st1,
                  toStep: st2,
                  action: 'approve',
                  actorId: s1.actorId,
                  comment: approveC(),
                  delegatedForId: s1.delegatedForId,
                },
              ],
            };
      }

      case 'lam-them-gio': {
        if (roll < 4)
          return {
            status: SubmissionStatus.DRAFT,
            currentStep: '',
            instanceStatus: null,
            steps: [],
          };
        if (roll < 4 + w(68, 45, 18)) {
          return {
            status: SubmissionStatus.APPROVED,
            currentStep: 'Đã duyệt',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            steps: [
              {
                fromStep: 'Chờ quản lý duyệt',
                toStep: 'Đã duyệt',
                action: 'approve',
                actorId: s1.actorId,
                comment: approveC(),
                delegatedForId: s1.delegatedForId,
              },
            ],
          };
        }
        if (roll < 4 + w(68, 45, 18) + w(12, 10, 5)) {
          return {
            status: SubmissionStatus.REJECTED,
            currentStep: 'Từ chối',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            steps: [
              {
                fromStep: 'Chờ quản lý duyệt',
                toStep: 'Từ chối',
                action: 'reject',
                actorId: s1.actorId,
                comment: pick(REJECT_COMMENTS),
                delegatedForId: s1.delegatedForId,
              },
            ],
          };
        }
        return {
          status: SubmissionStatus.UNDER_REVIEW,
          currentStep: 'Chờ quản lý duyệt',
          instanceStatus: WorkflowInstanceStatus.ACTIVE,
          steps: [],
        };
      }

      case 'tam-ung':
      case 'cong-tac': {
        const st2 = formKey === 'tam-ung' ? 'Chờ tài chính duyệt' : 'Chờ hành chính duyệt';
        const step2Actor = formKey === 'tam-ung' ? financeId : hanhChinhId;
        if (roll < 4)
          return {
            status: SubmissionStatus.DRAFT,
            currentStep: '',
            instanceStatus: null,
            steps: [],
          };
        if (roll < 4 + w(50, 28, 10)) {
          return {
            status: SubmissionStatus.APPROVED,
            currentStep: 'Đã duyệt',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            steps: [
              {
                fromStep: 'Chờ quản lý duyệt',
                toStep: st2,
                action: 'approve',
                actorId: s1.actorId,
                comment: approveC(),
                delegatedForId: s1.delegatedForId,
              },
              {
                fromStep: st2,
                toStep: 'Đã duyệt',
                action: 'approve',
                actorId: step2Actor,
                comment: approveC(),
              },
            ],
          };
        }
        if (roll < 4 + w(50, 28, 10) + w(13, 10, 4)) {
          return chance(0.5)
            ? {
                status: SubmissionStatus.REJECTED,
                currentStep: 'Từ chối',
                instanceStatus: WorkflowInstanceStatus.COMPLETED,
                steps: [
                  {
                    fromStep: 'Chờ quản lý duyệt',
                    toStep: 'Từ chối',
                    action: 'reject',
                    actorId: s1.actorId,
                    comment: pick(REJECT_COMMENTS),
                    delegatedForId: s1.delegatedForId,
                  },
                ],
              }
            : {
                status: SubmissionStatus.REJECTED,
                currentStep: 'Từ chối',
                instanceStatus: WorkflowInstanceStatus.COMPLETED,
                steps: [
                  {
                    fromStep: 'Chờ quản lý duyệt',
                    toStep: st2,
                    action: 'approve',
                    actorId: s1.actorId,
                    comment: approveC(),
                    delegatedForId: s1.delegatedForId,
                  },
                  {
                    fromStep: st2,
                    toStep: 'Từ chối',
                    action: 'reject',
                    actorId: step2Actor,
                    comment: pick(REJECT_COMMENTS),
                  },
                ],
              };
        }
        if (
          formKey === 'tam-ung' &&
          roll < 4 + w(50, 28, 10) + w(13, 10, 4) + w(8, 6, 3)
        ) {
          return {
            status: SubmissionStatus.RETURNED,
            currentStep: 'Trả lại',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            canRevise: true,
            steps: [
              {
                fromStep: 'Chờ quản lý duyệt',
                toStep: 'Trả lại',
                action: 'return_for_edit',
                actorId: s1.actorId,
                comment: pick(RETURN_COMMENTS),
                delegatedForId: s1.delegatedForId,
              },
            ],
          };
        }
        return chance(0.5)
          ? {
              status: SubmissionStatus.UNDER_REVIEW,
              currentStep: 'Chờ quản lý duyệt',
              instanceStatus: WorkflowInstanceStatus.ACTIVE,
              steps: [],
            }
          : {
              status: SubmissionStatus.UNDER_REVIEW,
              currentStep: st2,
              instanceStatus: WorkflowInstanceStatus.ACTIVE,
              steps: [
                {
                  fromStep: 'Chờ quản lý duyệt',
                  toStep: st2,
                  action: 'approve',
                  actorId: s1.actorId,
                  comment: approveC(),
                  delegatedForId: s1.delegatedForId,
                },
              ],
            };
      }

      case 'mua-sam': {
        const mgr = s1.actorId;
        // Tài chính: 25% duyệt qua uỷ quyền bởi TP Hành chính
        const fin = chance(0.25)
          ? { actorId: hanhChinhId, delegatedForId: financeId }
          : {
              actorId: financeId,
              delegatedForId: undefined as string | undefined,
            };
        if (roll < 4)
          return {
            status: SubmissionStatus.DRAFT,
            currentStep: '',
            instanceStatus: null,
            steps: [],
          };
        if (roll < 4 + w(50, 28, 10)) {
          // APPROVED: 2 phiếu song song (fromStep === toStep) + bản ghi hoàn tất join
          return {
            status: SubmissionStatus.APPROVED,
            currentStep: 'Đã duyệt',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            steps: [
              {
                fromStep: 'Chờ duyệt',
                toStep: 'Chờ duyệt',
                action: 'Quản lý phê duyệt',
                actorId: mgr,
                comment: approveC(),
                delegatedForId: s1.delegatedForId,
              },
              {
                fromStep: 'Chờ duyệt',
                toStep: 'Chờ duyệt',
                action: 'Tài chính phê duyệt',
                actorId: fin.actorId,
                comment: approveC(),
                delegatedForId: fin.delegatedForId,
              },
              {
                fromStep: 'Chờ duyệt',
                toStep: 'Đã duyệt',
                action: 'PARALLEL_JOIN_COMPLETE',
                actorId: fin.actorId,
                comment:
                  'Parallel approval complete: Quản lý phê duyệt, Tài chính phê duyệt',
              },
            ],
          };
        }
        if (roll < 4 + w(50, 28, 10) + w(14, 10, 5)) {
          return {
            status: SubmissionStatus.REJECTED,
            currentStep: 'Từ chối',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            steps: [
              {
                fromStep: 'Chờ duyệt',
                toStep: 'Từ chối',
                action: 'reject',
                actorId: chance(0.5) ? mgr : financeId,
                comment: pick(REJECT_COMMENTS),
              },
            ],
          };
        }
        // ACTIVE: 0 hoặc 1 phiếu
        return chance(0.5)
          ? {
              status: SubmissionStatus.UNDER_REVIEW,
              currentStep: 'Chờ duyệt',
              instanceStatus: WorkflowInstanceStatus.ACTIVE,
              steps: [],
            }
          : {
              status: SubmissionStatus.UNDER_REVIEW,
              currentStep: 'Chờ duyệt',
              instanceStatus: WorkflowInstanceStatus.ACTIVE,
              steps: [
                {
                  fromStep: 'Chờ duyệt',
                  toStep: 'Chờ duyệt',
                  action: 'Quản lý phê duyệt',
                  actorId: mgr,
                  comment: approveC(),
                  delegatedForId: s1.delegatedForId,
                },
              ],
            };
      }

      case 'tuyen-dung': {
        const screener = hrManagerId;
        const voters = (() => {
          const pool = [
            ...allManagerIds.filter((id) => id !== hrManagerId),
            adminId,
          ];
          const a = pick(pool);
          let b = pick(pool);
          while (b === a) b = pick(pool);
          return [a, b];
        })();
        if (roll < 4)
          return {
            status: SubmissionStatus.DRAFT,
            currentStep: '',
            instanceStatus: null,
            steps: [],
          };
        if (roll < 4 + w(45, 25, 8)) {
          return {
            status: SubmissionStatus.APPROVED,
            currentStep: 'Đã duyệt',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            steps: [
              {
                fromStep: 'Đề xuất',
                toStep: 'Bỏ phiếu hội đồng',
                action: 'Bắt đầu xem xét',
                actorId: screener,
                comment: 'Hồ sơ đề xuất hợp lệ, trình ban lãnh đạo bỏ phiếu',
              },
              {
                fromStep: 'Bỏ phiếu hội đồng',
                toStep: 'Bỏ phiếu hội đồng',
                action: 'vote_approve',
                actorId: voters[0],
                comment: 'Nhất trí với đề xuất, nhu cầu thực tế',
              },
              {
                fromStep: 'Bỏ phiếu hội đồng',
                toStep: 'Bỏ phiếu hội đồng',
                action: 'vote_approve',
                actorId: voters[1],
                comment: 'Đồng ý tuyển',
              },
              {
                fromStep: 'Bỏ phiếu hội đồng',
                toStep: 'Đã duyệt',
                action: 'VOTING_COMPLETE',
                actorId: voters[1],
                comment: 'Voting concluded. Threshold: 2 approvals needed.',
              },
            ],
          };
        }
        if (roll < 4 + w(45, 25, 8) + w(13, 10, 4)) {
          return {
            status: SubmissionStatus.REJECTED,
            currentStep: 'Từ chối',
            instanceStatus: WorkflowInstanceStatus.COMPLETED,
            steps: [
              {
                fromStep: 'Đề xuất',
                toStep: 'Bỏ phiếu hội đồng',
                action: 'Bắt đầu xem xét',
                actorId: screener,
                comment: 'Trình ban lãnh đạo xem xét',
              },
              {
                fromStep: 'Bỏ phiếu hội đồng',
                toStep: 'Bỏ phiếu hội đồng',
                action: 'vote_reject',
                actorId: voters[0],
                comment: 'Ngân sách nhân sự quý này đã hết, đề nghị hoãn',
              },
              {
                fromStep: 'Bỏ phiếu hội đồng',
                toStep: 'Bỏ phiếu hội đồng',
                action: 'vote_reject',
                actorId: voters[1],
                comment: 'Chưa cấp thiết, ưu tiên điều chuyển nội bộ',
              },
              {
                fromStep: 'Bỏ phiếu hội đồng',
                toStep: 'Từ chối',
                action: 'VOTING_COMPLETE',
                actorId: voters[1],
                comment: 'Voting concluded. Threshold: 2 approvals needed.',
              },
            ],
          };
        }
        // ACTIVE: vừa nộp / đang chấm hồ sơ / đã có 1 phiếu
        const sub = rand();
        if (sub < 0.34)
          return {
            status: SubmissionStatus.UNDER_REVIEW,
            currentStep: 'Đề xuất',
            instanceStatus: WorkflowInstanceStatus.ACTIVE,
            steps: [],
          };
        if (sub < 0.67) {
          return {
            status: SubmissionStatus.UNDER_REVIEW,
            currentStep: 'Bỏ phiếu hội đồng',
            instanceStatus: WorkflowInstanceStatus.ACTIVE,
            steps: [
              {
                fromStep: 'Đề xuất',
                toStep: 'Bỏ phiếu hội đồng',
                action: 'Bắt đầu xem xét',
                actorId: screener,
                comment: 'Hồ sơ hợp lệ, trình bỏ phiếu',
              },
            ],
          };
        }
        return {
          status: SubmissionStatus.UNDER_REVIEW,
          currentStep: 'Bỏ phiếu hội đồng',
          instanceStatus: WorkflowInstanceStatus.ACTIVE,
          steps: [
            {
              fromStep: 'Đề xuất',
              toStep: 'Bỏ phiếu hội đồng',
              action: 'Bắt đầu xem xét',
              actorId: screener,
              comment: 'Hồ sơ hợp lệ, trình bỏ phiếu',
            },
            {
              fromStep: 'Bỏ phiếu hội đồng',
              toStep: 'Bỏ phiếu hội đồng',
              action: 'vote_approve',
              actorId: voters[0],
              comment: 'Đồng ý với đề xuất',
            },
          ],
        };
      }
    }
    return null;
  }

  // Phân bổ form theo tần suất thực tế
  const FORM_WEIGHTS: Array<{ key: string; weight: number }> = [
    { key: 'nghi-phep', weight: 26 },
    { key: 'lam-them-gio', weight: 22 },
    { key: 'tam-ung', weight: 13 },
    { key: 'mua-sam', weight: 11 },
    { key: 'cong-tac', weight: 11 },
    { key: 'gop-y', weight: 8 },
    { key: 'tuyen-dung', weight: 5 },
    { key: 'thu-viec', weight: 4 },
  ];
  function pickFormKey(): string {
    const total = FORM_WEIGHTS.reduce((s, f) => s + f.weight, 0);
    let r = rand() * total;
    for (const f of FORM_WEIGHTS) {
      r -= f.weight;
      if (r <= 0) return f.key;
    }
    return FORM_WEIGHTS[0].key;
  }

  // Hàng đợi thông báo (tạo sau khi có submission)
  const notifQueue: Array<{
    userId: string;
    title: string;
    content: string;
    type: string;
    read: boolean;
    createdAt: Date;
    metadata?: any;
  }> = [];
  const auditQueue: Array<{
    actorId: string;
    action: string;
    targetId: string;
    newValues: any;
    createdAt: Date;
  }> = [];

  const statusCount: Record<string, number> = {};
  let totalSubs = 0;
  let totalRevisions = 0;
  let delegatedApprovals = 0;

  for (let age = DAYS - 1; age >= 0; age--) {
    const perDay = randInt(9, 15);
    for (let i = 0; i < perDay; i++) {
      const formKey = pickFormKey();
      // Tuyển dụng & thử việc do HR nộp; còn lại nhân viên nộp
      const submitterId =
        formKey === 'tuyen-dung' || formKey === 'thu-viec'
          ? pick(hrIds)
          : pick(submitterPool);

      const createdAt = (() => {
        const d = addDays(now, -age);
        d.setHours(randInt(8, 17), randInt(0, 59), randInt(0, 59), 0);
        if (d > now) d.setTime(now.getTime() - randInt(1, 4) * 3600_000);
        return d;
      })();

      const traj = buildTrajectory(formKey, submitterId, age);
      if (!traj) continue;

      const data = genFormData(formKey, submitterId, createdAt);
      const submission = await prisma.submission.create({
        data: {
          tenantId,
          formId: formMap[formKey],
          submittedBy: submitterId,
          data,
          status: traj.status,
          revisionNumber: 1,
          createdAt,
          updatedAt: createdAt,
        },
      });
      totalSubs++;
      statusCount[traj.status] = (statusCount[traj.status] ?? 0) + 1;

      // DRAFT / form không workflow → không tạo instance
      if (traj.instanceStatus !== null && wfMap[formKey]) {
        const instance = await prisma.workflowInstance.create({
          data: {
            tenantId,
            definitionId: wfMap[formKey],
            submissionId: submission.id,
            currentStep: traj.currentStep,
            status: traj.instanceStatus,
            createdAt,
            updatedAt: createdAt,
          },
        });

        // Bản ghi SUBMIT đầu tiên
        let t = createdAt;
        const initState = wfConfigs[formKey].config.initialState;
        await prisma.workflowHistory.create({
          data: {
            tenantId,
            instanceId: instance.id,
            fromStep: null,
            toStep: initState,
            action: 'SUBMIT',
            actorId: submitterId,
            createdAt: t,
          },
        });

        // Các bước tiếp theo, mỗi bước cách 2-20 giờ
        for (const step of traj.steps) {
          t = addHours(t, randInt(2, 20));
          if (t > now) t = new Date(now.getTime() - randInt(10, 90) * 60_000);
          await prisma.workflowHistory.create({
            data: {
              tenantId,
              instanceId: instance.id,
              fromStep: step.fromStep,
              toStep: step.toStep,
              action: step.action,
              actorId: step.actorId,
              comment: step.comment ?? null,
              delegatedForId: step.delegatedForId ?? null,
              createdAt: t,
            },
          });
          if (step.delegatedForId) delegatedApprovals++;
        }
        await prisma.workflowInstance.update({
          where: { id: instance.id },
          data: { updatedAt: t },
        });

        // Chuỗi nộp lại (revision) cho đơn bị trả lại
        if (traj.canRevise && age >= 2 && chance(0.6)) {
          t = addHours(t, randInt(3, 24));
          if (t > now) t = new Date(now.getTime() - randInt(10, 60) * 60_000);
          await prisma.workflowHistory.create({
            data: {
              tenantId,
              instanceId: instance.id,
              fromStep: 'Trả lại',
              toStep: initState,
              action: 'resubmit',
              actorId: submitterId,
              comment: 'Đã chỉnh sửa, bổ sung theo yêu cầu và nộp lại',
              createdAt: t,
            },
          });

          const revisedData = { ...data };
          if (formKey === 'nghi-phep')
            revisedData.nguoiBanGiao = randomColleague(submitterId);
          const childOld = age >= 5 && chance(0.6);
          const childStatus = childOld
            ? SubmissionStatus.APPROVED
            : SubmissionStatus.UNDER_REVIEW;

          const child = await prisma.submission.create({
            data: {
              tenantId,
              formId: formMap[formKey],
              submittedBy: submitterId,
              data: revisedData,
              status: childStatus,
              parentSubmissionId: submission.id,
              revisionNumber: 2,
              createdAt: t,
              updatedAt: t,
            },
          });
          totalSubs++;
          totalRevisions++;
          statusCount[childStatus] = (statusCount[childStatus] ?? 0) + 1;

          const childInst = await prisma.workflowInstance.create({
            data: {
              tenantId,
              definitionId: wfMap[formKey],
              submissionId: child.id,
              currentStep: childOld ? 'Đã duyệt' : initState,
              status: childOld
                ? WorkflowInstanceStatus.COMPLETED
                : WorkflowInstanceStatus.ACTIVE,
              createdAt: t,
              updatedAt: t,
            },
          });
          await prisma.workflowHistory.create({
            data: {
              tenantId,
              instanceId: childInst.id,
              fromStep: null,
              toStep: initState,
              action: 'SUBMIT',
              actorId: submitterId,
              comment: 'Nộp lại (bản sửa đổi lần 2)',
              createdAt: t,
            },
          });
          if (childOld) {
            // Bản sửa được duyệt nhanh qua cả 2 bước
            const s1c = step1Approver(submitterId);
            let tc = addHours(t, randInt(2, 12));
            if (tc > now)
              tc = new Date(now.getTime() - randInt(5, 30) * 60_000);
            const st2 = formKey === 'tam-ung' ? 'Chờ tài chính duyệt' : 'Chờ nhân sự duyệt';
            const fin2 = formKey === 'tam-ung' ? financeId : pick(hrIds);
            await prisma.workflowHistory.create({
              data: {
                tenantId,
                instanceId: childInst.id,
                fromStep: initState,
                toStep: st2,
                action: 'approve',
                actorId: s1c.actorId,
                comment: 'Đã bổ sung đầy đủ, duyệt',
                delegatedForId: s1c.delegatedForId ?? null,
                createdAt: tc,
              },
            });
            tc = addHours(tc, randInt(2, 12));
            if (tc > now)
              tc = new Date(now.getTime() - randInt(2, 20) * 60_000);
            await prisma.workflowHistory.create({
              data: {
                tenantId,
                instanceId: childInst.id,
                fromStep: st2,
                toStep: 'Đã duyệt',
                action: 'approve',
                actorId: fin2,
                comment: pick(APPROVE_COMMENTS),
                createdAt: tc,
              },
            });
          }
        }

        // Thông báo cho 4 ngày gần nhất
        if (age <= 3 && notifQueue.length < 45) {
          const formName = formDefs.find((f) => f.key === formKey)!.name;
          const submitterName = userFullName[submitterId];
          if (traj.status === SubmissionStatus.UNDER_REVIEW) {
            const approver =
              traj.currentStep === 'Chờ nhân sự duyệt' ||
              traj.currentStep === 'Chờ nhân sự xác nhận'
                ? pick(hrIds)
                : traj.currentStep === 'Chờ tài chính duyệt'
                  ? financeId
                  : traj.currentStep === 'Chờ hành chính duyệt'
                    ? hanhChinhId
                    : traj.currentStep === 'Bỏ phiếu hội đồng' ||
                        traj.currentStep === 'Đề xuất'
                      ? hrManagerId
                      : deptManagerOf(submitterId);
            notifQueue.push({
              userId: approver,
              title: `${formName} — cần xử lý`,
              content: `${submitterName} đã nộp "${formName}", đang chờ bạn xử lý`,
              type: 'INFO',
              read: chance(0.3),
              createdAt: addHours(createdAt, 1),
              metadata: { submissionId: submission.id },
            });
          } else if (traj.status === SubmissionStatus.APPROVED) {
            notifQueue.push({
              userId: submitterId,
              title: `${formName} đã được phê duyệt`,
              content: `Yêu cầu "${formName}" của bạn đã được phê duyệt thành công`,
              type: 'SUCCESS',
              read: chance(0.5),
              createdAt: addHours(createdAt, randInt(4, 24)),
              metadata: { submissionId: submission.id },
            });
          } else if (traj.status === SubmissionStatus.REJECTED) {
            notifQueue.push({
              userId: submitterId,
              title: `${formName} bị từ chối`,
              content: `Yêu cầu "${formName}" của bạn đã bị từ chối, xem chi tiết lý do trong đơn`,
              type: 'WARNING',
              read: chance(0.4),
              createdAt: addHours(createdAt, randInt(4, 24)),
              metadata: { submissionId: submission.id },
            });
          } else if (traj.status === SubmissionStatus.RETURNED) {
            notifQueue.push({
              userId: submitterId,
              title: `${formName} bị trả lại để bổ sung`,
              content: `Yêu cầu "${formName}" cần chỉnh sửa, bổ sung thông tin và nộp lại`,
              type: 'WARNING',
              read: chance(0.4),
              createdAt: addHours(createdAt, randInt(2, 12)),
              metadata: { submissionId: submission.id },
            });
          }
        }

        // Audit log cho hành động cuối (đơn đã chốt, ngày gần)
        if (
          age <= 5 &&
          auditQueue.length < 20 &&
          traj.steps.length > 0 &&
          (traj.status === SubmissionStatus.APPROVED ||
            traj.status === SubmissionStatus.REJECTED)
        ) {
          const last = traj.steps[traj.steps.length - 1];
          auditQueue.push({
            actorId: last.actorId,
            action:
              traj.status === SubmissionStatus.APPROVED ? 'APPROVE' : 'REJECT',
            targetId: submission.id,
            newValues: { status: traj.status, step: traj.currentStep },
            createdAt: addHours(createdAt, randInt(4, 30)),
          });
        }
      }
    }
  }

  console.log(
    `\nTạo ${totalSubs} đơn nộp trải đều ${DAYS} ngày (trong đó ${totalRevisions} bản nộp lại — revision chain)`,
  );
  console.log(
    `  • Phê duyệt qua uỷ quyền (delegatedForId): ${delegatedApprovals} lượt`,
  );
  console.log('  • Phân bố trạng thái:', JSON.stringify(statusCount));

  // ---- 8. Notifications ----
  for (const n of notifQueue) {
    await prisma.notification.create({
      data: {
        tenantId,
        userId: n.userId,
        title: n.title,
        content: n.content,
        type: n.type,
        read: n.read,
        metadata: n.metadata ?? undefined,
        createdAt: n.createdAt,
      },
    });
  }
  console.log(`Tạo ${notifQueue.length} thông báo (đã đọc/chưa đọc trộn lẫn)`);

  // ---- 9. Audit logs ----
  for (const a of auditQueue) {
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorId: a.actorId,
        action: a.action,
        targetModel: 'Submission',
        targetId: a.targetId,
        newValues: a.newValues,
        ipAddress: `10.0.${randInt(1, 5)}.${randInt(2, 250)}`,
        createdAt: a.createdAt,
      },
    });
  }
  console.log(`Tạo ${auditQueue.length} audit log (APPROVE/REJECT)`);

  // ---- 10. Job records (export) ----
  const jobs = [
    {
      type: JobType.EXPORT,
      status: JobStatus.DONE,
      progress: 100,
      createdBy: hrManagerId,
      result: {
        url: `https://res.cloudinary.com/techvision/raw/upload/flowform/exports/${isoDate(addDays(now, -2))}_bao-cao-nghi-phep.xlsx`,
        rows: 142,
      },
      createdAt: addDays(now, -2),
    },
    {
      type: JobType.EXPORT,
      status: JobStatus.DONE,
      progress: 100,
      createdBy: financeId,
      result: {
        url: `https://res.cloudinary.com/techvision/raw/upload/flowform/exports/${isoDate(addDays(now, -1))}_bao-cao-tam-ung.xlsx`,
        rows: 38,
      },
      createdAt: addDays(now, -1),
    },
    {
      type: JobType.EXPORT,
      status: JobStatus.FAILED,
      progress: 45,
      createdBy: userMap['tp.sanpham'],
      error:
        'Timeout khi tổng hợp dữ liệu, vui lòng thử lại với khoảng thời gian ngắn hơn',
      createdAt: addHours(now, -5),
    },
    {
      type: JobType.NOTIFICATION,
      status: JobStatus.DONE,
      progress: 100,
      createdBy: adminId,
      result: { sent: 147, failed: 3 },
      createdAt: addDays(now, -3),
    },
  ];
  for (const j of jobs) {
    await prisma.jobRecord.create({
      data: {
        tenantId,
        type: j.type,
        status: j.status,
        progress: j.progress,
        result: (j as any).result ?? undefined,
        error: (j as any).error ?? undefined,
        createdBy: j.createdBy,
        createdAt: j.createdAt,
        updatedAt: j.createdAt,
      },
    });
  }
  console.log(`Tạo ${jobs.length} job nền (export/notification)`);

  // ---- 11. Settings ----
  const settings = [
    { key: 'ten_cong_ty', value: 'Công ty Cổ phần Công nghệ TechVision' },
    { key: 'ten_viet_tat', value: 'TechVision' },
    {
      key: 'dia_chi',
      value:
        'Tầng 12, Tòa nhà Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội',
    },
    { key: 'email_lien_he', value: `hr@${DOMAIN_EMAIL}` },
    { key: 'so_phep_nam_mac_dinh', value: 12 },
    {
      key: 'gio_lam_viec',
      value: { batDau: '08:30', ketThuc: '17:30', nghiTrua: '12:00-13:00' },
    },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { tenantId_key: { tenantId, key: s.key } },
      create: { tenantId, key: s.key, value: s.value as any },
      update: { value: s.value as any },
    });
  }
  console.log(`Tạo ${settings.length} cài đặt hệ thống`);

  // ---- Summary ----
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║         TechVision — Seed dữ liệu công ty 150 nhân sự                ║
╠══════════════════════════════════════════════════════════════════════╣
║  Mật khẩu mọi tài khoản: ${PASSWORD}                                  ║
╠══════════════════════════════════════════════════════════════════════╣
║  TÀI KHOẢN DEMO CHÍNH                                                ║
║  admin@techvision.vn       ADMIN    Tổng Giám đốc                    ║
║  hoang.lm@techvision.vn    MANAGER  Giám đốc Kỹ thuật (nhận uỷ quyền)║
║  tung.pt@techvision.vn     MANAGER  TP Kinh doanh (đang uỷ quyền đi) ║
║  phuoc.dh@techvision.vn    MANAGER  TP Tài chính (duyệt chi/mua sắm) ║
║  huong.nt@techvision.vn    MANAGER  TP Nhân sự (thẩm định tuyển dụng)║
║  linh.np@techvision.vn     HR       CV Nhân sự (nhận uỷ quyền phép)  ║
║  + 3 HR khác, 4 MANAGER khác, 138 nhân viên USER                     ║
╠══════════════════════════════════════════════════════════════════════╣
║  BIỂU MẪU: 8 (đủ text/number/date/select, regex, min/max,            ║
║              minLength/maxLength, afterField, 5 theme, ẩn danh)      ║
║  QUY TRÌNH: 7 (1/2/3 bước tuần tự, song song, bỏ phiếu, SLA,         ║
║              requireComment, resubmit)                               ║
║  ĐƠN NỘP: ${String(totalSubs).padEnd(4)} trải ${DAYS} ngày — đủ DRAFT/SUBMITTED/UNDER_REVIEW/   ║
║           APPROVED/REJECTED/RETURNED/CANCELLED + revision chain      ║
║  UỶ QUYỀN: 3 (toàn bộ / theo form / theo workflow) — có lịch sử      ║
║           duyệt thay (delegatedForId) thật trong WorkflowHistory     ║
║  KHÁC: ${String(notifQueue.length).padEnd(2)} thông báo, ${auditQueue.length} audit log, 4 job export/notification      ║
╠══════════════════════════════════════════════════════════════════════╣
║  KỊCH BẢN DEMO GỢI Ý                                                 ║
║  1. USER nộp "Đơn xin nghỉ phép" → MANAGER duyệt → HR xác nhận       ║
║  2. MANAGER trả lại đơn → USER sửa & nộp lại (revision chain)        ║
║  3. Đăng nhập hoang.lm: duyệt thay TP Kinh doanh (uỷ quyền)          ║
║  4. Mua sắm: 2 người duyệt song song mới hoàn tất (PARALLEL_JOIN)    ║
║  5. Tuyển dụng: HR trình → 2 lãnh đạo bỏ phiếu thuận (VOTING)        ║
║  6. ADMIN xem Dashboard: biểu đồ 15 ngày, top form, SLA metrics      ║
╚══════════════════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
