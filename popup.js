// let colors = document.querySelector(".colors")
// let btn = document.querySelector("#btn")

// colors.onclick = function(){
//   colors.classList.toggle("active")
// }

document.addEventListener("DOMContentLoaded", () => {
  const sidebarLinks = document.querySelectorAll(".nav-link");
  const pages = document.querySelectorAll(".page");

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      // console.log(link)

      sidebarLinks.forEach((link) => link.classList.remove("active"));
      link.classList.add("active");
      const targetPageId = link.getAttribute("data-target");
      pages.forEach((page) => page.classList.remove("active"));

      const targetPage = document.getElementById(targetPageId);
      if (targetPage) {
        targetPage.classList.add("active");
      }
    });
  });
});
