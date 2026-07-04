// app/curricula/data.js

// Mapping of program names to their curriculum PNG image paths
// Each program may have 1 or 2 pages

const CURRICULA_DATA = [
  {
    college: "College of Arts and Sciences",
    collegeCode: "CAS",
    programs: [
      { name: "BA Communication Arts", slug: "BA-Communication-Arts", pages: 2 },
      { name: "BA Philosophy", slug: "BA-Philosophy", pages: 2 },
      { name: "BA Sociology", slug: "BA-Sociology", pages: 2 },
      { name: "BS Agricultural Chemistry", slug: "BS-Agricultural-Chemistry", pages: 2 },
      { name: "BS Applied Mathematics", slug: "BS-Applied-Mathematics", pages: 2 },
      { name: "BS Applied Physics", slug: "BS-Applied-Physics", pages: 2 },
      { name: "BS Biology", slug: "BS-Biology", pages: 2 },
      { name: "BS Chemistry", slug: "BS-Chemistry", pages: 2 },
      { name: "BS Mathematics", slug: "BS-Mathematics", pages: 2 },
      { name: "BS Statistics", slug: "BS-Statistics", pages: 2 },
    ],
  },
  {
    college: "College of Agriculture and Food Science",
    collegeCode: "CAFS",
    programs: [
      { name: "BS Agricultural Biotechnology", slug: "BS-Agricultural-Biotechnology", pages: 2 },
      { name: "BS Agriculture", slug: "BS-Agriculture", pages: 2 },
      { name: "BS Food Science and Technology", slug: "BS-Food-Science-and-Technology", pages: 2 },
    ],
  },
  {
    college: "College of Development Communication",
    collegeCode: "CDC",
    programs: [
      { name: "BS Development Communication", slug: "BS-Development-Communication", pages: 2 },
    ],
  },
  {
    college: "College of Economics and Management",
    collegeCode: "CEM",
    programs: [
      { name: "BS Agribusiness Management & Entrepreneurship", slug: "BS-Agribusiness-Management-Entrepreneurship", pages: 2 },
      { name: "BS Agricultural and Applied Economics", slug: "BS-Agricultural-and-Applied-Economics", pages: 2 },
      { name: "BS Economics", slug: "BS-Economics", pages: 2 },
    ],
  },
  {
    college: "College of Engineering and Agro-Industrial Technology",
    collegeCode: "CEAT",
    programs: [
      { name: "BS Chemical Engineering", slug: "BS-Chemical-Engineering", pages: 2 },
      { name: "BS Civil Engineering", slug: "BS-Civil-Engineering", pages: 2 },
      { name: "BS Electrical Engineering", slug: "BS-Electrical-Engineering", pages: 1 },
      { name: "BS Industrial Engineering", slug: "BS-Industrial-Engineering", pages: 1 },
      { name: "BS Mechanical Engineering", slug: "BS-Mechanical-Engineering", pages: 1 },
    ],
  },
  {
    college: "College of Forestry and Natural Resources",
    collegeCode: "CFNR",
    programs: [
      { name: "BS Forestry", slug: "BS-Forestry", pages: 1 },
    ],
  },
  {
    college: "College of Human Ecology",
    collegeCode: "CHE",
    programs: [
      { name: "BS Human Ecology", slug: "BS-Human-Ecology", pages: 2 },
      { name: "BS Nutrition", slug: "BS-Nutrition", pages: 1 },
    ],
  },
  {
    college: "College of Veterinary Medicine",
    collegeCode: "CVM",
    programs: [
      { name: "Doctor of Veterinary Medicine", slug: "Doctor-of-Veterinary-Medicine", pages: 1 },
    ],
  },
];

export default CURRICULA_DATA;
